/* ============================================================================
 * Twitchphobe :: patch.js  —  runs INSIDE Twitch's player worker, right after
 * net.js. This is the actual magic trick: when Twitch asks for a sub-only VOD
 * and gets told "no," we quietly BUILD the playlist ourselves from pieces
 * that are already public. It's not theft, it's... aggressive re-upholstery.
 * I have been awake for a concerning number of hours. My tail has gone quiet,
 * which either means I'm peaceful or I've ascended. There is no third option.
 * ==========================================================================*/
(() => {
  'use strict';

  // Only patch once per worker. importScripts would happily run us twice and I
  // am NOT debugging a double-wrapped fetch at [checks notes] whatever AM it is.
  if (self.__twitchphobePatched) return;
  self.__twitchphobePatched = true;

  // net.js is our polite little fetch layer. Grab the handle while we're here.
  const net = self.TPNet;
  const LOG = '[Twitchphobe]';
  const M3U8_TYPE = 'application/vnd.apple.mpegurl';   // the MIME type HLS lives under

  /* Every quality Twitch might offer, best to worst. "chunked" is the raw source
     — the original upload, un-transcoded, the good stuff, the chef's kiss. We list
     it first because the player picks the first usable rung and I want us to aim
     high. Ambition. Even while falling asleep at the wheel. --------------------- */
  const QUALITIES = [
    { key: 'chunked', resolution: 'chunked', frameRate: 60 },
    { key: '1440p60', resolution: '2560x1440', frameRate: 60 },
    { key: '1080p60', resolution: '1920x1080', frameRate: 60 },
    { key: '720p60', resolution: '1280x720', frameRate: 60 },
    { key: '480p30', resolution: '854x480', frameRate: 30 },
    { key: '360p30', resolution: '640x360', frameRate: 30 },
    { key: '160p30', resolution: '284x160', frameRate: 30 }
  ];

  // Twitch wants a "serving id" in the playlist header. Is it real? No. Does the
  // player care? Also no. We just mash the keyboard for 32 chars and hope. It's
  // the most honest thing in this entire codebase and that bothers me sometimes.
  const createServingId = () => {
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
    let id = '';
    for (let i = 0; i < 32; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
    return id;
  };

  /* fetchVideoMeta: ask GraphQL for the boring-but-load-bearing facts about a
     VOD — what kind of broadcast it was, when it was made, where its storyboards
     live (that URL secretly encodes the CDN path we need), and who owns it.
     All of this is public metadata. No auth. Just vibes and a client-id. ------ */
  const fetchVideoMeta = async (vodId) => {
    const json = await net.gql(
      `query { video(id: "${vodId}") { broadcastType, createdAt, seekPreviewsURL, owner { login } } }`
    );
    return (json && json.data && json.data.video) || null;
  };

  /* probeQuality: figure out which codec a rendition actually uses, so our fake
     playlist doesn't LIE about it (players HATE that, they throw a whole fit).
     - .ts segments  -> plain H.264, the reliable old friend.
     - .mp4 segments -> fMP4; peek the init file to tell HEVC ("hev1") from H.264.
     Returns the CODECS string, or null if the rendition's a ghost. ------------- */
  const probeQuality = async (url) => {
    const body = await net.getText(url);
    if (!body) return null;
    if (body.includes('.ts')) return 'avc1.4D001E';

    if (body.includes('.mp4')) {
      const init = await net.getText(url.replace(/[^/]+\.m3u8$/, 'init-0.mp4'), { range: 4096 });
      if (!init) return 'hev1.1.6.L93.B0';
      return init.includes('hev1') ? 'hev1.1.6.L93.B0' : 'avc1.4D001E';
    }

    return null;
  };

  /* buildPlaylist: assemble a real, playable HLS master playlist for a VOD that
     usher just refused to serve. We reverse-engineer the CDN paths from public
     metadata, probe which qualities actually EXIST, and stitch them together.
     If you're reading this at 3am questioning your life: same. But it compiles. */
  const buildPlaylist = async (vodId, meta, isV2) => {
    if (!meta || !meta.seekPreviewsURL) return null;

    // The storyboard URL is a treasure map. Its host = our CDN domain, and the
    // path segment right before "storyboards" = the opaque "specialId" we need.
    // Twitch did not INTEND for this to be useful. We are simply opportunistic.
    const seekUrl = new URL(meta.seekPreviewsURL);
    const domain = seekUrl.host;

    const parts = seekUrl.pathname.split('/');
    const marker = parts.findIndex((p) => p.includes('storyboards'));
    const specialId = marker > 0 ? parts[marker - 1] : null;
    if (!specialId) return null;

    // Old VODs are stored differently than new ones (of course they are), so we
    // sniff the broadcast type and age to pick the right URL shape. Highlights
    // live one way, ancient uploads another, everything else a third. Fun! Right?
    const broadcastType = (meta.broadcastType || '').toLowerCase();
    const login = (meta.owner && meta.owner.login) || '';
    const ageDays = (Date.now() - new Date(meta.createdAt).getTime()) / 86400000;

    /* !! DO NOT "SIMPLIFY" THESE URLS, FUTURE ME. !! I already tried. The version
       with the neat little `/vod/` prefix 404'd into the shadow realm and cost me
       an evening I'll never get back. These exact shapes are the ones that resolve.
       Touch them and I will find a way to be disappointed in you across time. ----- */
    const urlFor = (key) => {
      if (broadcastType === 'highlight') {
        return `https://${domain}/${specialId}/${key}/highlight-${vodId}.m3u8`;
      }
      if (broadcastType === 'upload' && ageDays > 7) {
        return `https://${domain}/${login}/${vodId}/${specialId}/${key}/index-dvr.m3u8`;
      }
      return `https://${domain}/${specialId}/${key}/index-dvr.m3u8`;
    };

    // Probe every quality at once. net.js caps concurrency and caches the results,
    // so this looks like a lot of requests but is really just... a moderate amount.
    const probed = await Promise.all(
      QUALITIES.map(async (q) => ({
        ...q,
        url: urlFor(q.key),
        codec: await probeQuality(urlFor(q.key))
      }))
    );

    // The playlist header. #EXTM3U says "I am a playlist," and the TWITCH-INFO
    // line is metadata Twitch's player half-expects. We forge a serving-id and
    // claim to be from "s3" in "EU". We are, as a people, from nowhere right now.
    const out = [
      '#EXTM3U',
      `#EXT-X-TWITCH-INFO:ORIGIN="s3",B="false",REGION="EU",USER-IP="127.0.0.1",SERVING-ID="${createServingId()}",CLUSTER="cloudfront_vod",USER-COUNTRY="BE",MANIFEST-CLUSTER="cloudfront_vod"`
    ];

    // Bandwidth starts absurdly high and steps down 100 per rung, so the player
    // thinks the top quality is the most expensive. It's a white lie. A fib. A
    // little performance. Nobody's getting hurt. (Legally: consult no one about this.)
    let bandwidth = 8534030;

    // Emit one stream entry per quality that actually EXISTED when we probed.
    // v2 playlists and legacy playlists speak slightly different dialects; we
    // handle both, because Twitch has two of everything and I am too tired to care.
    for (const { key, resolution, frameRate, url, codec } of probed) {
      if (!codec) continue;   // ghost rendition -> skip it, don't feed the player lies

      if (isV2) {
        const source = key === 'chunked' ? 'source' : 'transcode';
        out.push(
          `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},CODECS="${codec},mp4a.40.2",RESOLUTION=${resolution},FRAME-RATE=${frameRate},STABLE-VARIANT-ID="${key}",IVS-NAME="${key}",IVS-VARIANT-SOURCE="${source}"`,
          url
        );
      } else {
        const enabled = key === 'chunked' ? 'YES' : 'NO';
        out.push(
          `#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="${key}",NAME="${key}",AUTOSELECT=${enabled},DEFAULT=${enabled}`,
          `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},CODECS="${codec},mp4a.40.2",RESOLUTION=${resolution},VIDEO="${key}",FRAME-RATE=${frameRate}`,
          url
        );
      }

      bandwidth -= 100;
    }

    // If we somehow listed zero real renditions, this "playlist" is a lie and the
    // player deserves better. Return null so the caller can admit defeat honestly.
    return out.some((l) => l.startsWith('#EXT-X-STREAM-INF')) ? out.join('\n') : null;
  };


  // Hold the real fetch in a vise before we replace it. We WILL need it again.
  const nativeFetch = self.fetch.bind(self);

  /* The main event. We wrap fetch so we can inspect what the worker asks for:
       1. CloudFront .m3u8  -> rewrite "-unmuted" to "-muted" (sub-only trick).
       2. usher rejection    -> synthesize a whole playlist (the big magic).
     Everything else passes straight through: untouched, unbothered, moisturized. */
  self.fetch = async (input, init) => {
    // fetch() can be called with a string, a Request, or a mystery object. Normalize
    // to a URL string so our matching logic doesn't have to care. Defensive, but in
    // a relaxed way, like a cat technically guarding the house but very much asleep.
    const url =
      typeof input === 'string' ? input
      : input instanceof Request ? input.url
      : String(input);

    const response = await nativeFetch(input, init);

    /* --- BRANCH 1: CloudFront playlists ---------------------------------------
       Sub-only VODs only expose the "-muted" segment variants, but the player
       asks for "-unmuted". So we do a find-and-replace on the way back and
       pretend that's what it wanted all along. Not a hack — customer service.
       And customer service is a lifestyle. ---------------------------------------- */
    if (url.includes('cloudfront') && url.includes('.m3u8')) {
      const body = await response.text();
      return new Response(body.replace(/-unmuted/g, '-muted'), {
        status: response.status,
        headers: { 'Content-Type': M3U8_TYPE }
      });
    }

    /* --- BRANCH 2: usher said no, so we say yes -------------------------------
       usher.ttvnw.net is Twitch's playlist bouncer. When it 403s a sub-only VOD,
       we don't take no for an answer — we fetch metadata, build the playlist, and
       serve it back with a 200 like we knew the password the whole time. --------- */
    if (url.startsWith('https://usher.ttvnw.net/vod/') && response.status !== 200) {
      const vodId = url.split('.m3u8')[0].split('/').pop();  // fish the id out of the URL
      const isV2 = url.includes('/vod/v2');                  // v2 speaks the other dialect

      try {
        const meta = await fetchVideoMeta(vodId);
        const playlist = meta ? await buildPlaylist(vodId, meta, isV2) : null;
        if (!playlist) return new Response('Twitchphobe: no playlist', { status: 403 });

        return new Response(playlist, {
          status: 200,
          headers: { 'Content-Type': M3U8_TYPE }
        });
      } catch (err) {
        // Something went sideways mid-synth. Log it for the humans, then return a
        // clean 403 so the player fails gracefully instead of hanging forever.
        // Even in defeat, we are tidy. That's the New England in me. *fading out*
        console.warn(`${LOG} patch failed, falling through`, err);
        return new Response('Twitchphobe: patch error', { status: 403 });
      }
    }

    return response;  // anything else: here's your bytes, go be free, little request
  };
})();


