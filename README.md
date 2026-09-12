# dsh-mobile-theme

[中文](README.zh.md) | English

A mobile adaptation plugin for DeepSeek Harness Web. Version **0.5.0 targets DSH 0.1.5-rc.2**. Its runtime has no additional dependencies: a no-op host entry loads a browser bundle using the official theme registry and layout services.

## Compatibility

| Item | Verified baseline |
|---|---|
| Latest release inspected | `dsh-v0.1.5-rc.2`, `fb2c4b9e698e30edb738bca4cf0618587db7d203` |
| Upstream master inspected | `c291e7961a515f6d7af9304e7fd1d257929aef26` (2026-09-10) |
| Theme and layout peers | Exactly `0.1.5-rc.2` |
| Older DSH versions | Use a matching older plugin; 0.5.0 does not claim backward compatibility |

The 0.1.5 release replaces Details with a tabbed right Sidebar, changes the main slot to `main`, and uses a Lexical `contenteditable` composer. This version adapts all three. Source findings and validation commands are in [COMPATIBILITY.md](COMPATIBILITY.md).

## Mobile features

Phone mode covers widths up to 767px, plus landscape phones up to 900×500px. Portrait tablets from 768–1023px receive smaller spacing adjustments; desktop layout remains native.

| Surface | Phone behavior |
|---|---|
| Main layout | Full-width conversation; no space reserved for the left icon rail |
| Left sidebar | ☰ opens a 320px / 88vw overlay; backdrop and Escape close it; session, search-result, new-session and global-panel navigation dismiss it |
| Right sidebar | Fullscreen file/tab preview, including landscape phones; native tabs, split state and close controls remain owned by DSH |
| Android Back | Closes the active drawer through its owning service; switching from the left drawer to the right preview reuses one history step |
| Composer | Touch-sized send/add controls; shrinking model selector and a single toolbar row; permission popovers remain unclipped |
| Keyboard | `interactive-widget=resizes-content`, safe-area padding and a `visualViewport` fallback for focused inputs and Lexical; initial/session-switch focus guard preserves intentional taps |
| Messages | Selectable text, larger actions and code-copy hit areas; assistant timestamps reveal on tap for four seconds; user timestamps stay visible |
| Settings | Drawer-width sheet with horizontal section navigation and scrolling content |
| Pickers and menus | Tall directory picker, touch-sized rows and footer actions, bounded command/mention menus, jobs and Cordis popovers |
| New feedback UI | Bounded feedback dialogs and larger action targets |
| Theme | Phone-only light/dark token overrides over the active theme; selectable `dsh-mobile` OLED-dark theme |

The plugin preserves the user's light/dark/system preference. Its presentation changes do not add model instructions, modify provider requests, or affect the KV cache. Native sidebar navigation may record UI state through DSH's own service.

## Install

Use the matching DSH release (`0.1.5-rc.2`, published on npm's `next` channel at the inspected baseline). From this repository's checkout:

```sh
npm run build
dsh plugin --profile web add "dsh-mobile-theme@file:$PWD"
dsh web
```

After plugin 0.5.0 is published, the equivalent npm install is `dsh plugin --profile web add dsh-mobile-theme@0.5.0`. Restart the Web profile after installation. Verify `document.body.dataset.dshMobileTheme` is `0.5.0` and `document.body.dataset.dshMobileLayout` is `ok`.

Remove with `dsh plugin --profile web remove dsh-mobile-theme`, then restart.

## Develop and validate

```sh
npm run build
npm test
npm run deploy:hot

# With the official DSH 0.1.5-rc.2 packages installed:
DSH_NODE_MODULES=/path/to/dsh/node_modules npm run check:upstream
```

`src/client.css` contains authoring styles. `src/selectors.json` maps `.dsh-Module_local` aliases to the exact owning package and stylesheet. The browser resolves those aliases against live `data-plugin-css` tags, follows late loads and HMR, and places its overrides after the host styles. Missing locals become inert selectors. The plugin no longer embeds old opaque CSS-module hashes.

Layout rules use validated `sidebar`, `main` and `rightbar` slot columns plus plugin-owned attributes. Validation accepts the browser's `minmax(0px, 1fr)` serialization. If the structure changes, stale marks are removed, the floating menu button is hidden, and the native layout remains available with a `degraded` diagnostic. Fiber disposal removes CSS, marks, listeners, timers and owned theme registrations.

`deploy:hot` builds and copies the browser bundle into `$DSH_HOME/profiles/web/node_modules/dsh-mobile-theme/lib/client.js`; DSH's HMR watcher reloads it. The plugin does not publish or update DSH itself.

## Remaining limits

- Module filenames, CSS local names, slot structure and service methods are still pre-stable upstream surfaces. Run `check:upstream` and [REGRESSION.md](REGRESSION.md) on each DSH upgrade.
- The statically bundled Markdown copy buttons use a scoped local-name pattern because they have no plugin stylesheet tag.
- If the host pushes a foreign history entry above a drawer, a UI close leaves that entry untouched. An old drawer marker can remain for a later Back press.
- Browser automation cannot establish physical keyboard, IME, iOS safe-area or Android system-back behavior; those remain device checks.
