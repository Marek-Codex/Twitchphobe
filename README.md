<div align="center">

# Twitchphobe

**Sub-only VODs, no subscription. Wicked simple, I know.**

![README visits](https://count.getloli.com/@marek-codex.twitchphobe?theme=booru-lewd)

![Manifest](https://img.shields.io/badge/Manifest-V3-3CA0FF?style=flat-square)
![Chromium](https://img.shields.io/badge/Chromium-Brave%20%7C%20Chrome%20%7C%20Edge%20%7C%20Opera-07111C?style=flat-square&logo=googlechrome&logoColor=white)
![Firefox](https://img.shields.io/badge/Firefox-115%2B-A03CFF?style=flat-square&logo=firefox&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-no%20build%20step-3CA0FF?style=flat-square&logo=javascript&logoColor=white)
![License](https://img.shields.io/badge/license-Apache--2.0-A03CFF?style=flat-square&logo=apache&logoColor=white)

[![Install userscript](https://img.shields.io/badge/Install-Userscript--Tampermonkey%20%7C%20ScriptCat%20%7C%20Violentmonkey-A03CFF?style=for-the-badge&logo=javascript&logoColor=white)](https://raw.githubusercontent.com/Marek-Codex/Twitchphobe/main/userscript/Twitchphobe.user.js)

**Watch subscriber-only Twitch VODs without subscribing.**

</div>

Lightweight browser extension, no build step, no dependencies — just some
plain JavaScript and a concerning amount of caffeine holding it all together.

> For personal / research use. It only reads publicly-reachable HLS renditions;
> no account, credential, or entitlement. It's re-upholstery, not theft.

---

## Why should this be locked away from you?

A whole institution exists on the idea that knowledge and culture shouldn't be
gated away from the people trying to reach it. The **Internet Archive** calls
itself "a library," exists to provide "universal access to all knowledge," and
digitizes books precisely because "not everyone has access" to the collections
that lock them away.

**Neil Gaiman** put it about as plainly as it can be put:

> "Libraries are about freedom. Freedom to read, freedom of ideas, freedom of
> communication. They're about education, pleasure, information, access… They
> are closing the gates that should be open."
> — Neil Gaiman, "Why our future depends on libraries, reading and daydreaming" (2013)

It's a narrow claim, and an honest one: **access shouldn't be arbitrarily
withheld from the person standing right there trying to reach it.** Twitchphobe
makes that same narrow claim about a subscriber-only VOD — and stops there. It
doesn't download it, repackage it, or hand it to anyone. It just lets your player
play it for you.

<sub>Sources:
[Internet Archive](https://archive.org/about/) ·
[Neil Gaiman / The Guardian](https://www.theguardian.com/books/2013/oct/15/neil-gaiman-future-libraries-reading-daydreaming)</sub>

---

## Distribution

**GitHub Releases is the canonical source.** There's no Chrome Web Store or
Firefox AMO listing, and there won't be — this is a paywall workaround, which
both stores explicitly prohibit ("circumventing paywalls," "unauthorized
streaming of copyrighted media"). Rather than lose a fight with reviewers — or
risk a developer account — this ships the honest way: grab a build from
[Releases](../../releases) and load it yourself.

Everything lives there — the Chromium zips, the Firefox `.xpi`, and the
userscript. No store middleman, no review to fail, no account to ban. Just a
cat, a folder, and a release page.

---

## Works on (basically) everything

The code is plain MV3 + standard APIs, so it runs on whole *families* of
browsers with no changes. Same bytes, different wrappers:

| Family | Examples | Load via | Stays after restart? |
|---|---|---|---|
| **Chromium** | Chrome, Edge, **Brave**, Opera, Opera GX, Vivaldi, Arc, Yandex, Samsung Internet, Chromium, Thorium, **Kiwi (Android)** | `-dragdrop.zip` or `-unpacked.zip` | ✅ Yes |
| **Firefox** | Firefox, LibreWolf, Waterfox, Floorp | `.xpi` (see below) | ⚠️ Temporary unless signed |
| **Userscript** | Tampermonkey, ScriptCat, Violentmonkey | `Twitchphobe.user.js` | ✅ Yes |
| **Safari** | Safari 15+ (macOS/iOS) | needs a Mac — `safari-web-extension-converter` | Depends on packaging |

**Safari is the only real gap**, and it's blocked by tooling, not code: converting
a WebExtension to a Safari Web Extension needs macOS + Xcode (`xcrun
safari-web-extension-converter`). The code is WebKit-compatible as-is; it just
needs a Mac (or a macOS CI runner) to wrap and sign it. A job for another day.

**Mobile note:** Chrome and Edge don't run extensions on Android at all, so
phones get Kiwi (works with the unpacked zip), Firefox for Android (via an AMO
listing, though its add-on set is curated), or Safari iOS (converted). Limited by
the platforms, not by us.


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
2. Pick your flavor from the [Releases](../../releases) page:

   - **Lazy (drag & drop):** grab **`Twitchphobe-<version>-dragdrop.zip`** and
     **drag it onto the extensions page.** No unzipping, no folder-hunting.
   - **Hands-on (unzip & load):** grab **`Twitchphobe-<version>-unpacked.zip`**,
     unzip it, then **Load unpacked** → select the resulting **`Twitchphobe/`**
     folder. (This zip is just the drag-drop one wearing a folder, for when you
     want to move it somewhere permanent. Chrome's fussy: drag-drop needs
     `manifest.json` at the archive root, so we ship both.)

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

[![Install userscript](https://img.shields.io/badge/One--click%20install-Twitchphobe.user.js-A03CFF?style=for-the-badge&logo=javascript&logoColor=white)](https://raw.githubusercontent.com/Marek-Codex/Twitchphobe/main/userscript/Twitchphobe.user.js)

Click the button with a userscript manager installed and it'll offer to install.
That's the whole one-click. `userscript/Twitchphobe.user.js` is committed, so
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

## Credit

The core playlist-synthesis approach is after
[besuper/TwitchNoSub](https://github.com/besuper/TwitchNoSub) (Apache-2.0). This
is an independent, leaner reimplementation — no vendored player, no build-time
worker patching, no dependencies — with a hardened network layer, GraphQL
variables instead of string-built queries, and `crypto`-seeded IDs. Full respect
to the original for mapping out how Twitch's VOD CDN is laid out.

---

## Notes

- If a playlist synth ever fails, `patch.js` logs a `[Twitchphobe] …` line to the
  console. Check there first before assuming the sky is falling.
- No build step, no dependencies, no tracking. It runs entirely client-side.
- Comments in the source are written by someone who has been awake too long.
  They're informative. They're also a cry for help. Both can be true.

## For maintainers

Two things are generated so the artifacts can't drift from source:

```bash
node tools/build-userscript.js   # regenerates Twitchphobe.user.js (net+patch inlined)
pwsh tools/build-zips.ps1        # regenerates the drag-drop + unpacked zips
```

Run these after editing `src/net.js` or `src/patch.js`. The `.user.js` is
committed ready-to-install; the zips are git-ignored and ship via Releases.

Released under the [Apache License 2.0](LICENSE) — fork it, tweak it, even
ship it commercially if you must. Just keep the credit intact: Section 4 of
the license requires redistributors to carry the [NOTICE](NOTICE), so
"Marek-Codex wrote this" stays attached to your fork. That's the whole
bargain — credit stays, forks stay open, everyone wins.

## Support

Twitchphobe is free and always will be. But if it un-paywalled a VOD for you and
you're feeling generous, the sleep-deprived cat who forged it runs on caffeine
and validation:

[![Ko-fi](https://img.shields.io/badge/Support_me_on_Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/MarekCodex)

No pressure — go watch your VODs. nyaa~
