# dsh-mobile-theme

[中文](README.zh.md) | English

Theme plugin that adapts the DeepSeek Harness Web surface to phones and tablets. It is a tree-out plugin package for the `web` profile, built strictly on the official extension points:

- **theme registry** (`ctx.theme`) — the theme service's `overrideTokens` layer API (the token-level analogue of slot shading) stacks a `{ light, dark }` token table over whatever theme is active on phone viewports (≤767px portrait, or ≤900×500 landscape), and the registry's `register` API adds a selectable `dsh-mobile` OLED-dark theme;
- **client plugin entry** (`dsh.client` / `exports["./client"]`) — the web plugin roster serves this package's browser bundle at `/plugins/dsh-mobile-theme/client.js`;
- **bundle patch** (`dsh.bundle.patch`) — one `insert` row puts the package into the profile's config tree, which is what makes the client-modules node half discover and serve it.

No React code, no host-plane services, no settings schema: the layout work is one injected stylesheet plus ~300 lines of DOM-safe behavior in the client bundle. The node half is a deliberate no-op apply — the web plugin scan requires the host entry to have a fiber.

## What it changes on phones (≤767px portrait, ≤900×500 landscape)

| Surface | Desktop behavior | Mobile behavior |
|---|---|---|
| Sidebar | grid column, 264–420px | fully hidden; a ☰ floating button (top-left) opens it as an **overlay drawer** (`min(320px, 88vw)`); Settings opens from the drawer foot and stays the drawer width; taps on **navigation rows** close it; search, settings, tools keep it open |
| Conversation | center column | **true full width** — the grid is overridden to a single `minmax(0, 1fr)` track, no rail is reserved |
| Header | fixed title row | left slot reserved for ☰; compact title cluster, horizontally scrollable utilities |
| Details panel | third grid column, 300–520px | right-side overlay drawer; the chat keeps the full width behind it |
| Column drag handles | visible | hidden (no col-resize on touch) |
| Composer | 34px send button, 16px clearance | 40px touch targets, tighter clearance, single-line bottom bar (the left tools group shrinks flexibly, selects truncate — no scroll container, which would clip the permission popover; the send button keeps its place), `env(safe-area-inset-bottom)` padding so the input bar clears the home indicator |
| Header/tabs | fixed 36px gaps | compact paddings, horizontally scrollable tab row |
| Message actions | 28px | 32px touch targets; **user-message times stay visible** (short text, negligible space); assistant time/stats labels are **hidden by default and revealed by tapping the message (auto-hide after 4s)** — the touch equivalent of hover; revealed labels are capped at 30% width + ellipsis, single line |
| Settings | centered 800px modal with side nav | fills the expanded drawer (same width as the menu) with a horizontally scrollable section nav |
| `/` `@` trigger menu | anchored to the composer | viewport-bounded, 44px rows, `55dvh` max height above the keyboard |
| Tool-call inspect button | hover-revealed (`opacity: 0`) | always visible on `hover: none` devices |
| Code copy buttons | text-sized | invisible `::after` hit-area expansion (~30×30px tap region), icon position unchanged |
| Scrolling | default | momentum scrolling + `overscroll-behavior` (no rubber-band chaining) |
| Landscape phones | desktop layout | full phone treatment (drawer + ☰) with a compact vertical rhythm |
| Directory picker | centered 680px dialog | full-screen sheet, 40px rows, footer actions share one row |
| Cordis panel | `bottom: 128px` popover | viewport-width sheet lifted clear of the composer |
| Goal bar / permissions / jobs | 28px controls | 36–44px controls; jobs menu becomes a fixed sheet under the header |
| Android back gesture | — | the back gesture closes the open drawer (marked history entries; foreign entries are never intercepted) |
| Keyboard | — | `visualViewport` fallback pads the conversation root above the keyboard on browsers whose layout viewport does not shrink (padding on the conversation root, not transform — the scroll area shrinks, not its content, so the to-bottom affordance stays glued; applied only while an editable is focused, retracted on blur); **switching sessions never pops the keyboard** (an intent guard drops programmatic composer focus) |
| Long-press copy | — | message/code text stays selectable, iOS link-callout suppressed on controls |
| Accessibility | — | ☰ button mirrors `aria-expanded` via a frame MutationObserver; both FABs' `aria-label` follow the app `html[lang]` |

The viewport meta is upgraded at runtime with `viewport-fit=cover` (real safe-area `env()` values on notched devices) and `interactive-widget=resizes-content` (Android Chrome keeps the composer above the on-screen keyboard).

Portrait tablets (768–1023px, below the official 1024px sidebar auto-collapse) get a modest tightening band: reduced side clearance, slightly larger send button. Landscape phones (≤900×500) join the phone treatment with an extra-compact vertical rhythm instead.

## Theme layer

On phone viewports (≤767px portrait, or ≤900×500 landscape) the plugin stacks `overrideTokens('dsh-mobile-theme', …)` over the **active** theme — the user's persisted `light` / `dark` / `system` preference is never touched. Every token is a `{ light, dark }` pair (the runtime mandates both modes), so flipping the OS color scheme keeps the palette legible:

- light: softer `rgb(250,250,250)` base, slightly stronger hairlines and interactive fills for direct sunlight;
- dark: an OLED-ladder (base `rgb(15,15,15)` → layers `21,21,23` / `27,27,28` → overlay `44,44,46`) with raised hover/active contrast.

The same dark palette is registered as the selectable `dsh-mobile` theme (`colorScheme: dark`). Third-party theme ids are in-process extensions by design — they never cross the built-in settings schema — so the auto layer is the primary mechanism; `dsh-mobile` exists for programmatic selection and registry inspection.

## Install

```sh
# From npm (once published):
dsh plugin --profile web add dsh-mobile-theme

# From this package's checkout:
dsh plugin --profile web add "dsh-mobile-theme@file:$PWD"

# The plugin manager reconciles the profile manifest automatically; verify:
cat "$DSH_HOME/profiles/web/package.json"   # bundles: [..., "dsh-mobile-theme"]

# Restart the Web profile so the running server recomposes its config tree:
dsh web
```

Uninstall: `dsh plugin --profile web remove dsh-mobile-theme`, then restart. Removing the dependency also removes its `dsh.profile.bundles` row on reconcile.

The plugin is a pure client bundle plus a no-op node half, so it never changes what the model sees and cannot affect sessions or settings.


A device-level regression checklist (`REGRESSION.md`) covers every feature for pre-publish / post-upgrade passes.

## Develop

```sh
npm run build     # embeds src/client.css + src/tokens.json + the package version into lib/client.js
npm test          # build + node:test suites (bundle shape, apply behavior under fakes)
npm run deploy:hot # build + copy lib/client.js into the running profile — no restart
```

`src/client.css` is the authoring stylesheet; `src/client.template.js` is the module-loader bundle template; `scripts/build-client.mjs` substitutes the three placeholders. The harness serves `lib/client.js` verbatim. **Hot updates**: the client-hmr node half stat-polls every graph bundle, so `deploy:hot` (a plain copy into `$DSH_HOME/profiles/web/node_modules/dsh-mobile-theme/lib/client.js`) triggers an SSE `rebuilt` frame — connected browsers swap the plugin fiber in place without a refresh or a server restart. A `dsh plugin --profile web update` would re-copy the installed package from source; the manual copy is the fast loop.

## Model experience

None. The plugin never assembles provider requests, never writes prompts, and never touches sessions or settings; the browser-side theme layer is presentation-only.

#### KV Cache impact

None; nothing model-visible is emitted.

## Architecture: upgrade resilience

The official seams that are documented as extension points are the theme token system (`--dsw-*`, `ctx.theme`), the slot system (slot names + `data-slot` wrappers + `ctx.slots`), the `ctx.layout` panel service, and the `data-*` state attributes. **CSS-module class hashes are build artifacts and were never a contract** — pinning them for layout is exactly the "official upgrade kills the plugin" failure mode. This package therefore splits its CSS into three tiers:

| Tier | What it does | Depends on | Failure mode on upstream change |
|---|---|---|---|
| 1 · official API | theme layer, registered theme, viewport meta, drawer toggles | token registry, `ctx.layout` | unaffected (documented API) |
| 2 · structural marks | full-width grid, overlay drawers, backdrop, ☰ / settings FABs, keyboard lift | `data-slot` structure + DOM column order, self-checked at runtime | **graceful degradation**: discovery fails → no marks → layout rules stay inert → the official rail layout remains, fully usable; `body[data-dsh-mobile-layout="degraded"]` + one console line report it |
| 3 · cosmetic | touch sizes, fullscreen settings sheet, picker/cordis/jobs tweaks | pinned 0.1.0-rc.6 class hashes, concentrated in one section | cosmetic-only loss; the app stays usable |

Tier 2 is the key mechanism: at apply time the bundle walks from the documented `[data-slot="sidebar"]` wrapper (slot wrapper → sidebar column → grid frame), verifies the frame against the app's inline `gridTemplateColumns` (self-check 1) and the third column against the `data-shell-overlay` sentinel (self-check 2), then tags the columns with plugin-owned `data-dsh-mobile-*` attributes. The stylesheet keys every layout-critical rule off those attributes — never a hash. A child-list MutationObserver re-marks if columns remount. Re-hashing classes upstream therefore cannot break the layout; only a change to the documented slot structure can, and then the plugin degrades rather than half-applies.

## Known limitations

- **Tier 3 cosmetic hashes are version-pinned**: the fine-grained tweaks target the class hashes shipped by `@deepseek-ai/dsh-*` 0.1.0-rc.6 (e.g. `VOzbGW_panel`, `uV2eYG_primary`). An upstream re-hash loses those tweaks (cosmetic only); the `npm test` selector contract makes the pin explicit and fails the build when this repo's own CSS drifts.
- **Drawer is CSS + JS agreement**: the rail is fully hidden on phones, so the drawer entry point is the injected ☰ floating button; backdrop/Escape closing and the button all go through `ctx.layout`. The settings gear clicks the official `sidebar.settings` trigger (`button[aria-haspopup="dialog"]`). 0.1.2's settings overlay is `position:fixed` inside the transformed sidebar column, so the stylesheet drops that transform while a modal dialog is open. Without the layout service the CSS layer still applies, but the FABs are not injected (the drawer stays hidden on phones).
- **Registered theme ids are in-process**: `dsh-mobile` is not persisted across reloads (built-in settings schema admits only `light`/`dark`/`system`) and the Appearance row does not list third-party themes — this is the documented surface-layer nature of third-party themes.
- **History-close edge**: if the app pushes its own history entries above an open drawer, a UI-driven close consumes the top entry and leaves the drawer's marked entry for one extra back press (the marker keeps the back handler from misfiring on foreign entries).
