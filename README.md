<div align="center">

# Twitchphobe

**Sub-only VODs, no subscription. Wicked simple, I know.**

![README visits](https://count.getloli.com/@marek-codex.twitchphobe?theme=booru-lewd)

![Manifest](https://img.shields.io/badge/Manifest-V3-3CA0FF?style=flat-square)
![Chromium](https://img.shields.io/badge/Chromium-Brave%20%7C%20Chrome%20%7C%20Edge%20%7C%20Opera-07111C?style=flat-square&logo=googlechrome&logoColor=white)
![Firefox](https://img.shields.io/badge/Firefox-115%2B-A03CFF?style=flat-square&logo=firefox&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-no%20build%20step-3CA0FF?style=flat-square&logo=javascript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-A03CFF?style=flat-square)

[![Install userscript](https://img.shields.io/badge/Install-Userscript-Tampermonkey%20%7C%20ScriptCat%20%7C%20Violentmonkey-A03CFF?style=for-the-badge&logo=javascript&logoColor=white)](https://raw.githubusercontent.com/Marek-Codex/Twitchphobe/main/Twitchphobe.user.js)

**Watch subscriber-only Twitch VODs without subscribing.**

</div>

Lightweight browser extension, no build step, no dependencies — just some
plain JavaScript and a concerning amount of caffeine holding it all together.

> For personal / research use. It only reads publicly-reachable HLS renditions;
> no account, credential, or entitlement. It's re-upholstery, not theft.

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
2. Grab **`Twitchphobe-<version>-dragdrop.zip`** from the
   [Releases](../../releases) page and **drag it onto the extensions page.**
   No folder-hunting, no unzipping.
   - (Or: **Load unpacked** → select the `Twitchphobe/` folder, if you're old-school.)
3. Open a sub-only VOD. It just… works. You're welcome.

## Install — Firefox

Firefox is the dramatic one. Heads up:

- **`about:debugging#/runtime/this-firefox`** → **This Firefox** → **Load Temporary
  Add-on** → pick **`Twitchphobe-<version>.xpi`** from
  [Releases](../../releases).
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
*is* the Firefox format — it's just a zip wearing a fancy hat.

---

## Userscript (Tampermonkey / ScriptCat / Violentmonkey)

No store, no manifest, no dev mode — just a userscript manager.

[![Install userscript](https://img.shields.io/badge/One--click%20install-Twitchphobe.user.js-A03CFF?style=for-the-badge&logo=javascript&logoColor=white)](https://raw.githubusercontent.com/Marek-Codex/Twitchphobe/main/Twitchphobe.user.js)

Click the button with a userscript manager installed and it'll offer to install.
That's the whole one-click. `Twitchphobe.user.js` is committed at the repo root,
so the link always serves the latest `main`. Same trick as the extension —
it wraps the player worker and synthesizes the playlist — just packaged as one
self-contained file with `net.js` + `patch.js` inlined.

**One catch, because physics:** this has to run in the **page's** world to touch
`window.Worker`. Most managers do that automatically with `@grant none`, but:

- **ScriptCat:** set the script's injection mode to **Page** (it defaults to a
  sandboxed content context, which can't see `window.Worker`).
- **Violentmonkey / Tampermonkey:** works out of the box; the header already
  declares `@inject-into page`.
- **Greasemonkey 4+** is the flaky one — if it misbehaves, prefer the others.

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

## For maintainers

`Twitchphobe.user.js` is generated so the userscript and the extension can't
drift apart. After editing `src/net.js` or `src/patch.js`:

```bash
node tools/build-userscript.js
```

(Node only — end users never run this. The `.user.js` is committed ready to install.)

Released under the [MIT License](LICENSE).
