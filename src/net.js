/* ============================================================================
 * Twitchphobe :: net.js  —  runs INSIDE Twitch's player worker.
 * This is the part that keeps us from being rude little gremlins to Twitch's
 * servers. Three jobs, and I'm doing all three on four hours of sleep and an
 * energy-drink tolerance my cardiologist will hear about eventually:
 *   1. Attribution  — you can swap in your OWN client-id so your traffic stops
 *                     carpooling in Twitch's public bucket. Be your own person.
 *   2. Restraint    — a concurrency cap + a cache, so loading one VOD doesn't
 *                     look like a small botnet from the outside. Polite.
 *   3. Backoff      — when Twitch says "slow down" (429/5xx), we actually do,
 *                     instead of mashing refresh like a feral raccoon. Me, mostly.
 * ==========================================================================*/
(() => {
  'use strict';

  // If net.js somehow loads twice (importScripts is not shy about it), bail.
  // One brain per worker. I can barely handle the one I've got.
  if (self.TPNet) return;

  const CONFIG = {
    /* Twitch's public web client-id. Swap this for your OWN from
       dev.twitch.tv and you get a private rate-limit bucket instead of
       sharing one with literally everyone watching Twitch right now.
       No OAuth, no token, no crying. Just a string. ---------------------------- */
    clientId: 'kimne78kx3ncx6brgo4mv6wki5h1ko',

    gqlUrl: 'https://gql.twitch.tv/gql',
    maxConcurrent: 4,          // four balls in the air is my personal maximum
    retries: 2,                // three tries total. I believe in us. Barely.
    cacheTtl: 5 * 60 * 1000    // five minutes — long enough to feel productive
  };

  // The velvet rope outside the club, and a count of who's already inside.
  const cache = new Map();
  const queue = [];
  let active = 0;

  // JavaScript's only real superpower is making you wait politely. nyaa~
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* acquire()/release() are a tiny semaphore. If there's room, walk right in.
     If the club is full, get in line and we'll tap you on the shoulder later.
     It's very "bouncer at a Providence dive bar," an energy I respect.
     -- "wait your turn" is apparently a universal law, even for network calls. */
  const acquire = () =>
    new Promise((resolve) => {
      if (active < CONFIG.maxConcurrent) {
        active++;
        resolve();
      } else {
        queue.push(resolve);
      }
    });

  // Someone left — pull the next poor soul off the velvet rope and let them in.
  // If nobody's waiting, we just decrement and stare into the middle distance.
  const release = () => {
    active--;
    const next = queue.shift();
    if (next) {
      active++;
      next();
    }
  };

  /* Runs `fn` under the concurrency cap. The `finally` is NON-NEGOTIABLE —
     if `fn` throws (a network blip, an abort, my will to live), the slot STILL
     gets released, otherwise one bad request deadlocks the whole queue forever.
     A semaphore that forgets to release is just a memory leak in a costume.
     -- and yes, I learned this the hard way, why do you ask. *slow blink* ----- */
  const limited = async (fn) => {
    await acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  };

  /* withRetry: tries a few times on naughty responses AND on hard throws.
     - 429 / 5xx  -> Twitch is having a moment, we back off exponentially.
                     If they send a Retry-After header we OBEY IT like good boys.
     - thrown err -> the network sneezed mid-flight; also worth another go.
     Capped at 5s so a grumpy Twitch can't park us here until the sun explodes.
     This whole function is basically me negotiating with a tired API. Relatable. */
  const withRetry = async (url, init) => {
    let lastErr = null;
    for (let attempt = 0; attempt <= CONFIG.retries; attempt++) {
      try {
        const res = await limited(() => fetch(url, init));
        if (res.status !== 429 && res.status < 500) return res; // good enough, ship it
        lastErr = null;
        const retryAfter = parseFloat(res.headers.get('Retry-After'));
        const backoff = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt;
        await sleep(Math.min(backoff, 5000));
      } catch (err) {
        lastErr = err;
        await sleep(Math.min(250 * 2 ** attempt, 5000));
      }
    }
    if (lastErr) throw lastErr; // every attempt threw -> let the caller grieve
    return null;                // every attempt returned junk -> "no, thank you"
  };

  // Read from cache if fresh, else say the Polish word for "nothing": undefined.
  const cached = (key) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CONFIG.cacheTtl) return hit.value;
    return undefined;
  };

  // Stuff it in the cache with a timestamp, because past-me needs to know when
  // this goes stale and I refuse to think about it again. That's future-me's job.
  const store = (key, value) => {
    cache.set(key, { at: Date.now(), value });
    return value;
  };
  /* getText: grab a URL as text, or null if the internet is being the internet.
     The `range` option only fetches the first N bytes — we use that when probing
     a codec and only care about the header, like judging a book by its first page
     except the book is a video file and I am SO tired. --------------------------- */
  const getText = async (url, opts = {}) => {
    const key = `text:${url}:${opts.range || 0}`;   // cache key includes the range!
    const hit = cached(key);
    if (hit !== undefined) return hit;

    try {
      const init = { cache: 'force-cache' };        // "please reuse what you have"
      if (opts.range) init.headers = { Range: `bytes=0-${opts.range - 1}` };

      const res = await withRetry(url, init);
      if (!res || !res.ok) return null;             // sad trombone

      return store(key, await res.text());
    } catch (err) {
      return null;                                  // we failed, gracefully, like a cat
    }
  };

  // gql: POST a GraphQL query at Twitch and hand back parsed JSON (or null).
  // Takes optional `variables` so callers can parameterize instead of string-
  // building IDs into the query — cleaner, injection-proof, less of a Twin of
  // the reference tool. Cached by query+variables, because the SAME VOD gets
  // asked about a lot and I am not paying that toll twice. *purrs at API*
  const gql = async (query, variables) => {
    const key = `gql:${query}:${variables ? JSON.stringify(variables) : ''}`;
    const hit = cached(key);
    if (hit !== undefined) return hit;

    try {
      const res = await withRetry(CONFIG.gqlUrl, {
        method: 'POST',
        headers: {
          'Client-Id': CONFIG.clientId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(variables ? { query, variables } : { query })
      });
      if (!res || !res.ok) return null;

      return store(key, await res.json());
    } catch (err) {
      return null;
    }
  };

  /* The public surface. Just two functions, that's all patch.js ever needed.
     I trimmed CONFIG and cache off the export earlier because NOTHING used them
     and dead API surface is how you accidentally become the over-engineered alt
     version we're all trying not to be. YAGNI, as the ancient ones said. ------ */
  self.TPNet = { getText, gql };
})();


