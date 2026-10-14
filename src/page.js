/* ============================================================================
 * Twitchphobe :: page.js  —  the "MAIN world" hook. Runs as a real page script.
 * My whole job is to cosplay as Twitch's own Worker constructor long enough to
 * slip net.js + patch.js into the IVS player worker before it boots. It's less
 * "hacking" and more "standing subtly behind someone in a group photo."
 * The caffeine has stopped helping and started narrating. Please send a blanket.
 * ==========================================================================*/
(() => {
  'use strict';

  /* Who loaded me? content.js set data-net / data-patch on my own <script> tag,
     so document.currentScript.dataset is how I find the resource URLs. If either
     one's missing, something upstream went sideways and there's no dignified way
     to continue, so we just... don't. Quietly. Like a cat leaving a room. ------- */
  const script = document.currentScript;
  const netUrl = script && script.dataset ? script.dataset.net : null;
  const patchUrl = script && script.dataset ? script.dataset.patch : null;
  if (!netUrl || !patchUrl) return;

  // Keep a leash on the REAL Worker so we can still summon the real thing later.
  const NativeWorker = window.Worker;

  /* readSync: a BLOCKING read of the worker's source. Yes, synchronous XHR, the
     thing they warn you about. But we NEED the full text in hand before the
     Worker is constructed, and there's no `await` in a constructor. It's gross,
     it's deprecated-adjacent, it's the only way. We're all making choices. ------ */
  const readSync = (url) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);                 // false = synchronous = "hold my coffee"
    xhr.overrideMimeType('text/javascript');     // don't let it sniff this as HTML
    xhr.send();
    return xhr.responseText;
  };

  // We subclass the native Worker. Same face, different brain. *ear flick*
  window.Worker = class Worker extends NativeWorker {
    constructor(url, options) {
      let target = url;

      /* We only touch INLINE workers (blob:/data:) that are NOT modules.
         Twitch's IVS player is exactly that. A module worker can't take
         importScripts() anyway, and rewriting a real file-URL worker would be
         rude and pointless. So: narrow scope, minimal mischief. --------------- */
      const isModule = !!(options && options.type === 'module');
      const isInline = typeof url === 'string' && /^(blob|data):/.test(url);

      if (isInline && !isModule) {
        try {
          const source = readSync(url);
          // Prepend our two scripts, then Twitch's original source. The worker
          // boots, runs importScripts(net, patch) FIRST, then Twitch's code finds
          // a fetch that's already been politely intercepted. Order is everything.
          target = URL.createObjectURL(
            new Blob(
              [`importScripts(${JSON.stringify(netUrl)}, ${JSON.stringify(patchUrl)});\n`, source],
              { type: 'text/javascript' }
            )
          );
        } catch (err) {
          target = url; // anything goes wrong -> hand back the boring original worker
        }
      }

      // And finally, actually build the thing. Deep breath. Almost done. nyaa.
      super(target, options);
    }
  };
})();
