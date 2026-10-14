/* ============================================================================
 * Twitchphobe :: content.js  —  the "isolated world" bit.
 * I am FINE. I have had, at most, maybe five... okay maybe six of the little
 * cans. The one with the swirl on it. My left eye has been blinking in morse
 * for twenty minutes and I've decided it's spelling encouragement. nyzzz.
 * ==========================================================================*/
(() => {
  'use strict';

  /* --- STEP ONE: smuggle page.js into the actual page ---------------------
     I can't touch window.Worker from in here — content scripts live in the
     "isolated world," which is basically the kiddie table of the JS party.
     So instead I yeet a real <script> tag at the page and pass it the two
     resource URLs it needs via dataset. Then I delete the tag, because I'm
     tidy, or at least I'm tidy for the eleven seconds before I crash.
     (Also: document.head might not exist yet at document_start, so we fall
     back to documentElement. Wicked thoughtful of past-me, actually.) ------- */
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/page.js');
  script.dataset.net = chrome.runtime.getURL('src/net.js');
  script.dataset.patch = chrome.runtime.getURL('src/patch.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  /* --- STEP TWO: delete the ugly "subscribers only" badges ---------------
     Twitch slaps these onto preview cards and then, out of sheer spite, keeps
     re-rendering them the second you remove one. So we set up a MutationObserver
     and just... continuously yeet them. It's not glamorous. It's not RESTful.
     It works, which is more than my posture does at this hour. --------------- */
  const RESTRICTION =
    '.video-preview-card-restriction, .sub-only-vod, [data-a-target="sub-only-vod"]';

  // `queued` is a bouncer: Twitch mutates the DOM nine-thousand times a second
  // and if we cleaned on literally every one my laptop would achieve orbit.
  // So we coalesce: one clean() per animation frame, max. You're welcome, CPU.
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

  // If <body> is already here, go now. If not, wait for DOMContentLoaded.
  // There's a whole joke here about waiting for my own body to exist too but
  // I'm too tired to land it. Bang a left, as my father would say. *ear twitch*
  if (document.body) startWatching();
  else document.addEventListener('DOMContentLoaded', startWatching, { once: true });
})();
