// ==UserScript==
// @name         Twitchphobe
// @namespace    https://github.com/Marek-Codex/Twitchphobe
// @version      1.3.1
// @description  Watch subscriber-only Twitch VODs without subscribing. Lightweight, no build step.
// @author       Marek-Codex
// @match        *://*.twitch.tv/*
// @icon         https://raw.githubusercontent.com/Marek-Codex/Twitchphobe/main/icons/icon128.png
// @grant        none
// @inject-into  page
// @run-at       document-start
// @all-frames   true
// @license      MIT
// ==/UserScript==

/* ============================================================================
 * Twitchphobe :: userscript build (page context).
 * Same trick as the extension, minus the manifest. We're running in the real
 * page world, so we can wrap window.Worker directly and slip our two scripts
 * into Twitch's IVS player worker. net.js + patch.js are inlined below as
 * strings — zero external requests, works offline-ish, one self-contained file.
 *
 * GENERATED FILE. Don't hand-edit: change tools/Twitchphobe.user.template.js or
 * src/*, then run `node tools/build-userscript.js`. It's basically a cat
 * copy-pasting himself into a worker and hoping Twitch doesn't notice. It notices.
 * ==========================================================================*/
(function () {
  'use strict';

  // One install per page. We are not in the business of double-wrapping fetch.
  if (window.__twitchphobeUser) return;
  window.__twitchphobeUser = true;

  // The two worker-context scripts, inlined verbatim from the extension source.
  const NET = "__NET_JS__";
  const PATCH = "__PATCH_JS__";

  /* --- wrap window.Worker (ported from the extension's page.js) ------------
     Twitch's player is a blob: worker. We read its source, prepend our two
     scripts, and hand back a NEW blob. No importScripts here because a
     userscript has no chrome-extension:// resource URLs to point at — so we
     concatenate the raw source instead. Same result, fewer moving parts. ------ */
  const NativeWorker = window.Worker;

  const readSync = (url) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.overrideMimeType('text/javascript');
    xhr.send();
    return xhr.responseText;
  };

  window.Worker = class Worker extends NativeWorker {
    constructor(url, options) {
      let target = url;

      const isModule = !!(options && options.type === 'module');
      const isInline = typeof url === 'string' && /^(blob|data):/.test(url);

      if (isInline && !isModule) {
        try {
          const source = readSync(url);
          const bootstrap = NET + '\n' + PATCH + '\n' + source;
          target = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }));
        } catch (err) {
          target = url; // if anything hiccups, hand back the boring original worker
        }
      }

      super(target, options);
    }
  };

  /* --- strip the cosmetic "sub-only" badges (ported from content.js) -------
     Because a paywall nag on a preview card is rude and we have standards.
     rAF-throttled so we clean once per frame, not once per DOM mutation. ------ */
  const RESTRICTION =
    '.video-preview-card-restriction, .sub-only-vod, [data-a-target="sub-only-vod"]';

  let queued = false;
  const clean = () => {
    queued = false;
    document.querySelectorAll(RESTRICTION).forEach((el) => el.remove());
  };

  const startWatching = () => {
    clean();
    new MutationObserver(() => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(clean);
      }
    }).observe(document, { childList: true, subtree: true });
  };

  if (document.body) startWatching();
  else document.addEventListener('DOMContentLoaded', startWatching, { once: true });
})();
