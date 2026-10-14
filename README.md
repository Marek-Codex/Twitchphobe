# Twitchphobe

Watch subscriber-only Twitch VODs without subscribing. Lightweight, no build
step, no dependencies — just some plain JavaScript and a concerning amount of
caffeine holding it all together.

> For personal / research use. This only reads publicly-reachable HLS renditions;
> it uses no account, credential, or entitlement. It's re-upholstery, not theft.

---

## Works on (basically) everything

| Browser | How you load it | Stays after restart? |
|---|---|---|
| **Brave / Chrome / Edge / Opera / Vivaldi** (any Chromium) | Drag the `.zip` onto the extensions page in dev mode, or *Load unpacked* | ✅ Yes |
| **Firefox** | `about:debugging` → **Load Temporary Add-on** (pick the `.xpi`) | ⚠️ Not by default — see below |
| **Safari** | Needs conversion first (`safari-web-extension-converter`) — a "problem for another day" | Depends on packaging |

---

## The short version of how it works

Twitch's player runs inside a `blob:` **Worker**. We wrap `window.Worker`,
slip two scripts into that worker via `importScripts(...)`, and when Twitch's
"usher" service refuses a sub-only VOD we *build the playlist ourselves* from
renditions that are already public. The player loads it like any normal VOD.

```
manifest.json   MV3. One content script; net/patch/page are web-accessible.
   │
   ├─ content.js   (isolated world)  injects page.js, strips "sub-only" badges
   ├─ page.js      (main world)      wraps window.Worker → boots net.js + patch.js
   ├─ net.js       (worker context)  throttled / retried / cached fetch + GQL
   └─ patch.js     (worker context)  rewrites the manifest the player fetches
```

---

## Install — Chromium (Brave, Chrome, Edge, Opera…)

1. `brave://extensions` → enable **Developer mode**
2. **Drag `Twitchphobe-1.3.1-dragdrop.zip` onto the page.** Done. No folder-hunting.
   - (Or: **Load unpacked** → select the `Twitchphobe/` folder, if you're old-school.)
3. Open a sub-only VOD. It just… works. You're welcome.

## Install — Firefox

Firefox is the dramatic one. Heads up:

- **`about:debugging#/runtime/this-firefox`** → **This Firefox** → **Load Temporary
  Add-on** → pick **`Twitchphobe-1.3.1.xpi`**.
- ⚠️ **"Temporary" means temporary.** It unloads the moment you restart Firefox.
  This is *not* just a label — Mozilla's own docs say a temporary add-on "remains
  installed until you remove it or restart Firefox."

**Want it to stick around in Firefox?** You need a **signed** add-on, because
that's the only kind release Firefox will install permanently. Your options:

1. **Easiest & free:** submit it to [addons.mozilla.org](https://addons.mozilla.org)
   — signing is free, and you can keep the listing *unlisted* and still
   self-distribute the signed `.xpi` afterward.
2. **Power-user / dev builds only:** `about:config` → `xpinstall.signatures.required`
   → `false`. This only works on Developer/Nightly/ESR/unbranded builds, not
   stable release. (The code is MV3, so it runs — it's the *signing gate*, not the
   code, that blocks stable Firefox.)
3. **Enterprise:** push it via policy if you're managing machines.

The good news: **the code needs zero changes for any of this.** It's already
MV3 with the `browser_specific_settings.gecko` block Firefox wants. The `.xpi`
you see here *is* the Firefox format — it's just a zip wearing a fancy hat.

---

## Use your own client-id (optional)

`src/net.js` → `CONFIG.clientId`. Register an app at [dev.twitch.tv](https://dev.twitch.tv),
paste your id in, and you get your own rate-limit bucket instead of sharing the
public web one with everyone. No OAuth, no crying. Default works fine too.

---

## Notes

- If a playlist synth ever fails, `patch.js` logs a `[Twitchphobe] …` line to the
  console. Check there first before assuming the sky is falling.
- No build step, no dependencies, no tracking. It runs entirely client-side.
- Comments in the source are written by someone who has been awake too long.
  They're informative. They're also a cry for help. Both can be true.
