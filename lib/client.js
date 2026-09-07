/**
 * Browser half of dsh-mobile-theme (module-loader bundle template).
 *
 * Built by scripts/build-client.mjs, which substitutes the two
 * placeholders with the JSON-escaped stylesheet and token table, and
 * writes the result to lib/client.js (the `exports["./client"]` artifact
 * the client-modules node half serves at /plugins/dsh-mobile-theme/client.js).
 *
 * Feature set:
 *   1. Injects the mobile stylesheet as a plugin-owned style tag
 *      (data-plugin-css, the convention the HMR driver tracks).
 *   2. Upgrades the viewport meta with viewport-fit=cover (real
 *      safe-area env() values) and interactive-widget=resizes-content
 *      (Android Chrome keeps the composer above the keyboard).
 *   3. Registers the selectable `dsh-mobile` OLED-dark theme through the
 *      official theme registry, idempotently (plugin reloads re-run apply).
 *   4. Stacks an automatic viewport theme layer over whatever theme is
 *      active on phones via ctx.theme.overrideTokens — the token-level
 *      analogue of slot shading: { light, dark } per token, disposed when
 *      the viewport widens, never fighting the user's persisted preference.
 *   5. Structural self-marking: discovers the shell columns through the
 *      documented slot/`data-slot` structure and DOM order, self-checks
 *      against the app's inline grid template, and tags them with
 *      data-dsh-mobile-* attributes the stylesheet keys off — layout CSS
 *      never pins hashed class names, and discovery failure degrades
 *      gracefully (rules inert, official layout intact, body marker set).
 *   6. Drawer behavior + ☰ / settings floating buttons: with the rail
 *      fully hidden on phones, two body-level buttons (outside React's
 *      tree) are the entry points — ☰ toggles the drawer, the gear clicks
 *      the official `sidebar.settings` trigger (`aria-haspopup="dialog"`).
 *      Backdrop clicks and Escape close the expanded sidebar via
 *      ctx.layout (read opportunistically with ctx.get — the plugin never
 *      hard-depends on ui-layout), and a tap inside the drawer closes it
 *      after React handles the tap.
 *   7. Accessibility + native navigation: the FAB mirrors aria-expanded
 *      through a MutationObserver on the frame's data attributes; opening
 *      a drawer pushes a marked history entry and the Android back
 *      gesture (popstate) closes it, while UI-driven closes consume the
 *      entry so no orphan history steps accumulate.
 *   8. Keyboard fallback: mirrors visualViewport into the
 *      --dsh-mobile-keyboard-inset CSS variable, shrinking the
 *      conversation root above the keyboard on browsers whose layout
 *      viewport does not shrink (focus-gated, retracted on blur).
 */
window.__ModuleLoader__.load({
  id: 'dsh-mobile-theme',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports

    var PACKAGE = 'dsh-mobile-theme'
    var CSS_TAG_ID = PACKAGE + '/client.css'
    var MOBILE_MQ = '(max-width: 767px), (max-width: 900px) and (max-height: 500px)'
    var MOBILE_THEME_ID = 'dsh-mobile'
    var VERSION = "0.4.4"

    var CSS = "/* dsh-mobile-theme — mobile adaptation stylesheet.\n *\n * Resilience tiers (see README §Architecture):\n *   Tier 1 — official theme API (overrideTokens/register): no CSS at all.\n *   Tier 2 — layout-critical rules key off `data-dsh-mobile-*` attributes\n *            the client bundle writes after discovering the shell columns\n *            through the documented slot/`data-slot` structure. Survives\n *            CSS-module re-hashing; discovery failure leaves the rules\n *            inert (graceful desktop-mode degradation, never broken).\n *   Tier 3 — fine-grained cosmetic tweaks pin the hashed class names\n *            shipped by @deepseek-ai/dsh-* 0.1.0-rc.6 (concentrated in\n *            the \"cosmetic\" sections). Their failure mode is cosmetic\n *            only. The test suite keeps the contract explicit.\n *\n * Color values are deliberately absent: every rule below consumes\n * --dsw-* tokens, so the layer stays correct under any active theme\n * (including the auto override layer this plugin stacks on phones).\n */\n\n/* ── phone viewport: portrait ≤ 767px, or landscape phones ─────────────── */\n/* (≤ 900px wide AND ≤ 500px tall — e.g. phones on their side)              */\n\n@media (max-width: 767px), (max-width: 900px) and (max-height: 500px) {\n  html {\n    -webkit-text-size-adjust: 100%;\n    text-size-adjust: 100%;\n  }\n\n  body {\n    overscroll-behavior: none;\n  }\n\n  /* Native tap-highlight is a desktop affordance; keep focus-visible. */\n  * {\n    -webkit-tap-highlight-color: transparent;\n  }\n\n  /* Buttons never trigger double-tap zoom or the iOS link callout. */\n  button,\n  [role=\"button\"] {\n    touch-action: manipulation;\n    -webkit-touch-callout: none;\n  }\n\n  /* ── shell frame: keep the official 56px icon rail, overlay when open ── */\n  /* 0.1.2 auto-collapses below 1024px into a 56px rail whose footer is the\n     settings trigger. Hiding that rail also hides Settings. Stay inside\n     the safe area for landscape notches. */\n  [data-dsh-mobile-frame] {\n    grid-template-columns: 56px minmax(0, 1fr) 0px !important;\n    padding-left: env(safe-area-inset-left, 0px);\n    padding-right: env(safe-area-inset-right, 0px);\n  }\n\n  /* No column drag handles on touch input. */\n  .pI_x6G_handle {\n    display: none;\n  }\n\n  /* Collapsed: official rail stays in flow (settings gear at the foot). */\n  [data-dsh-mobile-sidebar-col] {\n    position: relative;\n    z-index: 40;\n    visibility: visible;\n    transform: none;\n    height: 100%;\n  }\n\n  /* Expanded: overlay drawer over the conversation; the 56px track stays\n     so the chat does not jump. */\n  [data-dsh-mobile-frame]:not([data-sidebar-collapsed]) [data-dsh-mobile-sidebar-col] {\n    position: absolute;\n    top: 0;\n    bottom: 0;\n    left: 0;\n    width: 320px;\n    width: min(320px, 88vw);\n    visibility: visible;\n    transform: none;\n    box-shadow: var(--dsw-shadow-lv3);\n    transition:\n      transform 0.24s var(--ds-ease-in-out),\n      box-shadow 0.24s var(--ds-ease-in-out);\n  }\n\n  /* 0.1.2 SettingsRoot paints a position:fixed overlay as a descendant of\n     the sidebar column. A parent transform makes `fixed` relative to that\n     ancestor, so the sheet stays trapped in the off-screen drawer. While a\n     modal dialog is open, drop the transform so the overlay covers the\n     viewport. Official overlay z-index is 1000 and hides the drawer. */\n  [data-dsh-mobile-sidebar-col]:has([role=\"dialog\"][aria-modal=\"true\"]) {\n    visibility: visible;\n    transform: none;\n    box-shadow: none;\n    overflow: visible;\n    transition: none;\n    pointer-events: none;\n  }\n\n  [data-dsh-mobile-sidebar-col]:has([role=\"dialog\"][aria-modal=\"true\"]) [role=\"presentation\"] {\n    pointer-events: auto;\n  }\n\n  /* Lift the official settings trigger above the home indicator when the\n     drawer is open; the body-level gear FAB is the collapsed-rail entry. */\n  [data-dsh-mobile-sidebar-col] [data-slot=\"sidebar\"] {\n    padding-bottom: env(safe-area-inset-bottom, 0px);\n    box-sizing: border-box;\n  }\n\n  /* Backdrop: covers the conversation while the drawer is open; any tap\n     outside the drawer dismisses it (handled by the client bundle). */\n  [data-dsh-mobile-frame]:not([data-sidebar-collapsed])::before {\n    content: \"\";\n    position: absolute;\n    inset: 0;\n    z-index: 30;\n    background: var(--dsw-alias-bg-mask-1);\n  }\n\n  /* Details panel: right-side overlay drawer (kept below the sidebar's\n     z-40 and the ☰ button's z-45 so both stay reachable). */\n  [data-dsh-mobile-details-col] {\n    position: absolute;\n    top: 0;\n    right: 0;\n    bottom: 0;\n    height: 100%;\n    width: 420px;\n    width: min(92vw, 420px);\n    z-index: 35;\n    transform: translateX(100%);\n    transition: transform 0.24s var(--ds-ease-in-out);\n  }\n\n  [data-dsh-mobile-frame]:not([data-details-collapsed]) [data-dsh-mobile-details-col] {\n    transform: none;\n    box-shadow: var(--dsw-shadow-lv3);\n  }\n\n  /* Details drawer: touch-size header and close button. */\n  .ydkMvW_header {\n    min-height: 48px;\n    padding: 12px;\n  }\n\n  .ydkMvW_close {\n    width: 36px;\n    height: 36px;\n  }\n\n  /* ── conversation chrome ──────────────────────────────────────────── */\n\n  .wSkVaW_root {\n    --dsh-composer-side-clearance: 12px;\n  }\n\n  .wSkVaW_header {\n    padding: 8px 12px 0;\n  }\n\n  .wSkVaW_titleRow {\n    min-height: 40px;\n  }\n\n  .wSkVaW_titleCluster {\n    gap: 6px;\n  }\n\n  .wSkVaW_crumb {\n    max-width: 120px;\n  }\n\n  .wSkVaW_headerUtilities {\n    margin-left: 8px;\n    max-width: 45%;\n    overflow-x: auto;\n    scrollbar-width: none;\n  }\n\n  .wSkVaW_headerUtilities::-webkit-scrollbar {\n    display: none;\n  }\n\n  .wSkVaW_tabs {\n    gap: 20px;\n    margin-top: 4px;\n    padding-left: 4px;\n    overflow-x: auto;\n    scrollbar-width: none;\n  }\n\n  .wSkVaW_tabs::-webkit-scrollbar {\n    display: none;\n  }\n\n  .wSkVaW_tab {\n    min-height: 40px;\n    white-space: nowrap;\n  }\n\n  .Md3f7G_scroll {\n    padding: 12px;\n    -webkit-overflow-scrolling: touch;\n    overscroll-behavior: none;\n  }\n\n  .gdEzaW_userStack {\n    max-width: min(525px, 88%);\n  }\n\n  /* Message text stays selectable for native long-press copy. */\n  .gdEzaW_bubble,\n  .Sxvs8a_body {\n    -webkit-user-select: text;\n    user-select: text;\n  }\n\n  .bqrRRG_root {\n    padding: 8px 12px 12px;\n  }\n\n  .wSkVaW_composerHero {\n    padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));\n  }\n\n  /* ── composer (input bar) ─────────────────────────────────────────── */\n\n  /* Keyboard fallback: the bundle writes this var from visualViewport\n     while an editable element is focused. The padding sits on the\n     conversation ROOT — outside the scroll container — so the scroll\n     area's visible height shrinks by the keyboard band instead of its\n     content: the seat and the to-bottom affordance stay glued to the\n     new bottom, no blank band. Structural selector (Tier 2): no hash. */\n  [data-dsh-mobile-center-col] [data-slot=\"conversation\"] > * {\n    box-sizing: border-box;\n    padding-bottom: var(--dsh-mobile-keyboard-inset, 0px);\n  }\n\n  .uV2eYG_root {\n    padding: 0 12px calc(10px + env(safe-area-inset-bottom, 0px));\n  }\n\n  .uV2eYG_card {\n    border-radius: 18px;\n  }\n\n  .uV2eYG_accessory {\n    padding: 10px 10px 0;\n  }\n\n  .uV2eYG_attachments {\n    padding: 4px 10px 0;\n  }\n\n  .uV2eYG_input,\n  .uV2eYG_mirror,\n  .uV2eYG_backdrop {\n    padding: 4px 8px 0 12px;\n  }\n\n  /* Single-line bottom bar: never wrap — the left tools group shrinks,\n     the send button keeps its place. IMPORTANT: no overflow-x here — the\n     permission-select popover (official Menu, inline absolute, side:top)\n     anchors inside this strip, and a scroll container would clip it\n     (overflow-x:auto also clips y, hiding the popover). */\n  .uV2eYG_row {\n    gap: 8px;\n    padding: 2px 6px 8px;\n    flex-wrap: nowrap;\n  }\n\n  .uV2eYG_tools {\n    gap: 8px;\n    flex: 1 1 auto;\n    min-width: 0;\n  }\n\n  .uV2eYG_modes {\n    gap: 8px;\n    flex: none;\n  }\n\n  .uV2eYG_add {\n    width: 36px;\n    height: 36px;\n    flex: none;\n  }\n\n  /* The select shrinks below its cap (native ellipsis) instead of\n     forcing the row to overflow. */\n  .uV2eYG_select {\n    max-width: 120px;\n    min-width: 0;\n    height: 32px;\n    flex: 0 1 auto;\n  }\n\n  .uV2eYG_primary {\n    width: 40px;\n    height: 40px;\n  }\n\n  /* ── touch-size controls ──────────────────────────────────────────── */\n\n  .p-xYUq_action {\n    width: 32px;\n    height: 32px;\n    padding: 7px;\n  }\n\n  .hHd-Xa_iconButton {\n    width: 36px;\n    height: 36px;\n  }\n\n  .hHd-Xa_newSession {\n    height: 44px;\n  }\n\n  ._7yHdaG_header {\n    height: 40px;\n  }\n\n  ._7yHdaG_row {\n    height: 40px;\n  }\n\n  ._7yHdaG_action {\n    width: 32px;\n    height: 32px;\n  }\n\n  /* Goal bar: roomier bar and icon buttons. */\n  .nLMEza_bar {\n    height: 44px;\n  }\n\n  .nLMEza_iconBtn {\n    width: 36px;\n    height: 36px;\n  }\n\n  .nLMEza_objectiveInput {\n    height: 32px;\n  }\n\n  /* Permission rows: bigger selector pill. */\n  .oY77xG_selector {\n    height: 40px;\n    padding: 0 16px;\n  }\n\n  /* Jobs popover: touch-size trigger/rows; menu becomes a fixed sheet\n     under the header instead of an anchored absolute popover. */\n  .QsffPG_trigger {\n    min-height: 36px;\n    padding: 4px 6px;\n  }\n\n  .QsffPG_row {\n    min-height: 40px;\n  }\n\n  .QsffPG_menu {\n    position: fixed;\n    top: 64px;\n    left: 12px;\n    right: 12px;\n    width: auto;\n    max-width: none;\n    max-height: calc(100dvh - 220px);\n  }\n\n  /* ── directory picker ─────────────────────────────────────────────── */\n\n  .ZuhsRW_dialog.ZuhsRW_dialog {\n    width: 100%;\n    height: calc(100dvh - 16px);\n    max-height: calc(100dvh - 16px);\n    border-radius: 0;\n  }\n\n  .ZuhsRW_content {\n    padding: 12px 12px 12px 16px;\n  }\n\n  .ZuhsRW_row {\n    height: 40px;\n  }\n\n  .ZuhsRW_millerRow,\n  .ZuhsRW_column {\n    -webkit-overflow-scrolling: touch;\n  }\n\n  /* Footer actions fill one shared row (single-line cancel/confirm). */\n  ._G5b-a_modalAction {\n    flex: 1;\n    min-width: 96px;\n    min-height: 40px;\n  }\n\n  /* ── cordis panel popover: clear of the composer ──────────────────── */\n\n  .Nqubda_panel {\n    left: 12px;\n    right: 12px;\n    width: auto;\n    max-width: none;\n    bottom: calc(150px + env(safe-area-inset-bottom, 0px));\n    max-height: 45vh;\n  }\n\n  /* ── code/terminal scrolling: momentum + contained overscroll ──────── */\n\n  ._block_10eou_7,\n  .o3BgMG_bodyScroll,\n  .o3BgMG_ioSection,\n  .o3BgMG_codeBody,\n  .o3BgMG_terminalBody {\n    -webkit-overflow-scrolling: touch;\n    overscroll-behavior-x: contain;\n  }\n\n  /* ── code copy buttons: bigger tap targets WITHOUT moving the icon ──\n     Both buttons are positioned (absolute top-right / sticky header) and\n     center their content inside the box, so growing the box would shift\n     the icon down out of line. Expand the hit area invisibly instead:\n     the pseudo-element stretches the tappable region outward while the\n     icon keeps its exact visual position. */\n  ._copyButton_10eou_142::after,\n  ._copyButton_srovd_22::after {\n    content: \"\";\n    position: absolute;\n    inset: -7px;\n  }\n\n  /* ── popup surfaces ───────────────────────────────────────────────── */\n\n  /* Settings becomes a full-screen sheet with a horizontally scrollable\n     section nav instead of the 188px side column.\n     Official CSS modules inject when Settings opens (after this tag), so\n     beat `.VOzbGW_nav { flex-direction: column }` with the dialog+nav\n     structure — hashes are a fallback. */\n  [role=\"dialog\"][aria-modal=\"true\"]:has(> nav),\n  .VOzbGW_panel.VOzbGW_panel {\n    width: 100%;\n    max-width: none;\n    height: 100dvh;\n    max-height: none;\n    border-radius: 0;\n    flex-direction: column;\n  }\n\n  /* Official row layout sized the content column by stretching it against\n     the panel's definite height; in the column layout its height is flex-\n     negotiated instead. Without min-height: 0 the wrapper's implicit\n     min-height: auto can refuse to shrink below the section content, the\n     whole thing overflows, and the panel's overflow: hidden clips the\n     tail with no scrollbar. Clamping it hands scrolling to the official\n     .VOzbGW_options (flex: 1; min-height: 0; overflow-y: auto). */\n  [role=\"dialog\"][aria-modal=\"true\"]:has(> nav) > :last-child,\n  .VOzbGW_content.VOzbGW_content {\n    min-height: 0;\n  }\n\n  [role=\"dialog\"][aria-modal=\"true\"] > nav,\n  .VOzbGW_nav.VOzbGW_nav {\n    flex: none;\n    flex-direction: row;\n    align-items: center;\n    gap: 4px;\n    width: 100%;\n    max-width: none;\n    padding: 10px 12px;\n    padding-top: calc(10px + env(safe-area-inset-top, 0px));\n    border-bottom: 1px solid var(--dsw-alias-border-l2);\n    overflow-x: auto;\n    scrollbar-width: none;\n  }\n\n  [role=\"dialog\"][aria-modal=\"true\"] > nav::-webkit-scrollbar,\n  .VOzbGW_nav.VOzbGW_nav::-webkit-scrollbar {\n    display: none;\n  }\n\n  [role=\"dialog\"][aria-modal=\"true\"] > nav > :first-child,\n  .VOzbGW_navTitle.VOzbGW_navTitle {\n    flex: none;\n    padding: 0 8px 0 0;\n    font-size: 14px;\n  }\n\n  [role=\"dialog\"][aria-modal=\"true\"] > nav > :last-child,\n  .VOzbGW_navList.VOzbGW_navList {\n    display: flex;\n    flex-direction: row;\n    flex: 1;\n    min-width: 0;\n    gap: 4px;\n  }\n\n  [role=\"dialog\"][aria-modal=\"true\"] > nav button,\n  .VOzbGW_navCell.VOzbGW_navCell {\n    flex: none;\n    height: 40px;\n  }\n\n  .VOzbGW_header.VOzbGW_header {\n    height: auto;\n    min-height: 54px;\n    padding: 12px 12px 8px;\n  }\n\n  .VOzbGW_options.VOzbGW_options {\n    padding: 0 16px 16px;\n  }\n\n  /* '/' and '@' trigger menu: bound to the viewport, above the keyboard. */\n  ._3e4SsG_menu {\n    left: 8px;\n    max-width: calc(100vw - 24px);\n    max-height: 55dvh;\n  }\n\n  ._3e4SsG_item {\n    min-height: 44px;\n  }\n}\n\n/* ── landscape phone band: compact vertical rhythm ─────────────────────── */\n\n@media (max-width: 900px) and (max-height: 500px) {\n  .wSkVaW_header {\n    padding: 4px 12px 0;\n  }\n\n  .wSkVaW_titleRow {\n    min-height: 32px;\n  }\n\n  .wSkVaW_tabs {\n    margin-top: 2px;\n  }\n\n  .wSkVaW_tab {\n    min-height: 32px;\n    padding-bottom: 6px;\n  }\n\n  .wSkVaW_composerSeat {\n    --dsh-composer-text-max-height: 120px;\n  }\n\n  .Md3f7G_scroll {\n    padding: 8px 12px;\n  }\n\n  .uV2eYG_root {\n    padding: 0 12px calc(6px + env(safe-area-inset-bottom, 0px));\n  }\n\n  .uV2eYG_card {\n    border-radius: 14px;\n  }\n\n  .uV2eYG_add {\n    width: 32px;\n    height: 32px;\n  }\n\n  .uV2eYG_primary {\n    width: 36px;\n    height: 36px;\n  }\n\n  .wSkVaW_composerHero {\n    padding-bottom: 12px;\n  }\n}\n\n/* ── the ☰ / settings floating buttons (injected by the client bundle) ── */\n\n.dsh-mobile-theme-fab,\n.dsh-mobile-theme-settings-fab {\n  display: none;\n}\n\n@media (max-width: 767px), (max-width: 900px) and (max-height: 500px) {\n  /* 0.1.2's collapsed rail already owns the panel toggle and Settings. */\n  .dsh-mobile-theme-fab,\n  .dsh-mobile-theme-settings-fab {\n    display: none;\n  }\n}\n\n/* ── hover-revealed controls on touch input ────────────────────────────── */\n\n@media (hover: none) {\n  /* The tool-call inspect button is opacity-0 until hover on desktop;\n     on touch it must be visible or it is unreachable. */\n  .o3BgMG_inspectButton {\n    opacity: 1;\n  }\n\n  /* The message time/stats labels are hover-revealed on desktop. Touch\n     has no hover, so the touch equivalent is a TAP: hidden by default,\n     shown while the message item carries the reveal mark (written by the\n     bundle for ~4s). Shown labels are capped + ellipsized — one line,\n     never overflowing into the next message. */\n  .p-xYUq_timeStart,\n  .p-xYUq_timeEnd {\n    display: none;\n  }\n\n  [data-dsh-mobile-times=\"1\"] .p-xYUq_timeStart,\n  [data-dsh-mobile-times=\"1\"] .p-xYUq_timeEnd {\n    /* block (not inline-flex): text-overflow only renders an ellipsis\n       on block containers — inline-flex hard-clips the tail instead. */\n    display: block;\n    min-width: 0;\n    max-width: 30%;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    font-size: 12px;\n    line-height: 20px;\n  }\n\n  [data-dsh-mobile-times=\"1\"] .p-xYUq_timeStart {\n    padding-right: 6px;\n  }\n\n  [data-dsh-mobile-times=\"1\"] .p-xYUq_timeEnd {\n    padding-left: 6px;\n  }\n\n  /* User messages carry only a short send time — keep it visible, never\n     truncated. (Later in the file than the reveal rules, and every\n     reveal-rule property is explicitly cancelled here — max-width /\n     overflow included — so the reveal mark can never clip the label.) */\n  .gdEzaW_userRow .p-xYUq_timeStart,\n  .gdEzaW_userRow .p-xYUq_timeEnd {\n    display: inline-flex;\n    max-width: none;\n    overflow: visible;\n    white-space: nowrap;\n    font-size: 12px;\n    line-height: 20px;\n    padding: 0;\n  }\n}\n\n/* ── tablet band (768–1023px portrait): modest tightening below the ────── */\n/* official 1024px sidebar auto-collapse breakpoint (the rail stays).       */\n\n@media (min-width: 768px) and (max-width: 1023px) and (min-height: 501px) {\n  .wSkVaW_root {\n    --dsh-composer-side-clearance: 12px;\n  }\n\n  .Md3f7G_scroll {\n    padding: 14px 20px;\n  }\n\n  .wSkVaW_tabs {\n    gap: 24px;\n  }\n\n  .uV2eYG_primary {\n    width: 38px;\n    height: 38px;\n  }\n}\n\n/* ── reduced motion ────────────────────────────────────────────────────── */\n\n@media (prefers-reduced-motion: reduce) {\n  [data-dsh-mobile-sidebar-col],\n  [data-dsh-mobile-details-col],\n  .dsh-mobile-theme-fab,\n  .dsh-mobile-theme-settings-fab {\n    transition: none;\n  }\n}\n"
    var TOKENS = {
  "--dsw-alias-bg-base": {
    "light": "rgb(250, 250, 250)",
    "dark": "rgb(15, 15, 15)"
  },
  "--dsw-alias-bg-layer-1": {
    "light": "rgb(250, 250, 250)",
    "dark": "rgb(21, 21, 23)"
  },
  "--dsw-alias-bg-layer-2": {
    "light": "rgb(255, 255, 255)",
    "dark": "rgb(27, 27, 28)"
  },
  "--dsw-alias-bg-overlay": {
    "light": "rgb(237, 237, 237)",
    "dark": "rgb(44, 44, 46)"
  },
  "--dsw-alias-interactive-bg-hover": {
    "light": "rgba(38, 49, 72, 0.08)",
    "dark": "rgba(255, 255, 255, 0.1)"
  },
  "--dsw-alias-interactive-bg-active": {
    "light": "rgba(38, 49, 72, 0.14)",
    "dark": "rgba(255, 255, 255, 0.16)"
  },
  "--dsw-alias-border-l2": {
    "light": "rgba(0, 0, 0, 0.12)",
    "dark": "rgba(255, 255, 255, 0.14)"
  },
  "--dsw-specific-sidebar-fill": {
    "light": "rgb(249, 250, 251)",
    "dark": "rgb(21, 21, 23)"
  },
  "--dsw-specific-input-major": {
    "light": "rgb(255, 255, 255)",
    "dark": "rgb(27, 27, 28)"
  }
}

    /** Version marker: lets a user confirm which bundle is actually live
     *  via `document.body` (no console noise in production). */
    function markVersion() {
      if (typeof document === 'undefined' || document.body === null) return
      document.body.setAttribute('data-dsh-mobile-theme', VERSION)
    }

    function injectCss() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css="' + CSS_TAG_ID + '"]') !== null) return
      var tag = document.createElement('style')
      tag.dataset.plugin = PACKAGE
      tag.dataset.pluginCss = CSS_TAG_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    function upgradeViewportMeta() {
      if (typeof document === 'undefined') return
      var meta = document.querySelector('meta[name="viewport"]')
      if (meta === null) return
      var content = meta.getAttribute('content') || ''
      var updates = []
      if (content.indexOf('viewport-fit=') === -1) updates.push('viewport-fit=cover')
      if (content.indexOf('interactive-widget=') === -1) updates.push('interactive-widget=resizes-content')
      if (updates.length === 0) return
      meta.setAttribute('content', (content ? content + ', ' : '') + updates.join(', '))
    }

    /** Single-mode token map for the registered `dsh-mobile` theme (dark palette). */
    function mobileThemeTokens() {
      var tokens = {}
      for (var name in TOKENS) {
        if (Object.prototype.hasOwnProperty.call(TOKENS, name)) tokens[name] = TOKENS[name].dark
      }
      return tokens
    }

    /** Idempotent registration: duplicate id throws in the registry. */
    function registerTheme(theme) {
      if (theme === null || typeof theme.register !== 'function') return
      var snapshot = theme.getTheme()
      var themes = snapshot !== null && snapshot.themes !== void 0 ? snapshot.themes : []
      for (var i = 0; i < themes.length; i++) if (themes[i].id === MOBILE_THEME_ID) return
      theme.register({ id: MOBILE_THEME_ID, colorScheme: 'dark', tokens: mobileThemeTokens() })
    }

    function apply(ctx) {
      try {
        safeApply(ctx)
      } catch (err) {
        // A plugin that throws during apply becomes a FAILED entry and the
        // whole mobile layer disappears. Never let that happen: contain,
        // report, and let this load run without the feature.
        try {
          console.error(PACKAGE + ': apply failed — plugin disabled for this load:', err)
        } catch (e2) {}
      }
    }

    function safeApply(ctx) {
      injectCss()
      upgradeViewportMeta()
      markVersion()
      registerTheme(ctx.theme)

      var mq = typeof matchMedia === 'function' ? matchMedia(MOBILE_MQ) : null

      // Guard bookkeeping shared across effects: the first user input and
      // the last tap inside the drawer.
      var pageTouchedAt = 0
      var recentDrawerTapAt = 0

      // Automatic viewport theme layer over the active theme.
      var disposeLayer = null
      function syncLayer() {
        var active = mq === null ? true : mq.matches
        if (active && disposeLayer === null) {
          disposeLayer = ctx.theme.overrideTokens(PACKAGE, TOKENS)
        } else if (!active && disposeLayer !== null) {
          disposeLayer()
          disposeLayer = null
        }
      }
      syncLayer()
      if (mq !== null) {
        ctx.effect(function () {
          function onChange() {
            syncLayer()
          }
          if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange)
          else if (typeof mq.addListener === 'function') mq.addListener(onChange)
          return function () {
            if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange)
            else if (typeof mq.removeListener === 'function') mq.removeListener(onChange)
            // Fiber teardown also retracts the active layer — an orphaned
            // override must not outlive the plugin that stacked it.
            if (disposeLayer !== null) {
              disposeLayer()
              disposeLayer = null
            }
          }
        }, PACKAGE + ': viewport theme layer')
      }

      // Keyboard fallback: mirror visualViewport into a CSS variable that
      // shrinks the conversation root above the keyboard when the layout
      // viewport does not shrink (older Android WebViews, some iOS
      // configurations).
      //
      // Two guards keep this from misfiring:
      //   * the value is only computed while an editable element is focused
      //     (no keyboard exists without focus — pinch-zoom and toolbar
      //     animations can otherwise fabricate a positive "inset");
      //   * focusout/blur retracts it immediately, so no stale lift can
      //     survive after the keyboard closes.
      // The stylesheet applies it as padding-bottom on the conversation
      // ROOT (outside the scroll container) — the scroll area's visible
      // height shrinks instead of its content, so the sticky seat and the
      // to-bottom affordance stay glued to the new bottom. On open/close
      // transitions the chat scroller is nudged to its floor so the
      // official sticky at-bottom state machine recomputes and the
      // "new message" pill cannot strand over the previous turn's tail.
      var win = typeof window !== 'undefined' ? window : null
      var rootEl = typeof document !== 'undefined' && document.documentElement ? document.documentElement : null
      if (win !== null && rootEl !== null && win.visualViewport && typeof win.visualViewport.addEventListener === 'function') {
        ctx.effect(function () {
          var vv = win.visualViewport
          var lastApplied = null
          function keyboardContextActive() {
            if (typeof document === 'undefined') return false
            var el = document.activeElement
            if (el === null || typeof el.tagName !== 'string') return false
            var tag = el.tagName.toUpperCase()
            return tag === 'TEXTAREA' || tag === 'INPUT'
          }
          function nudgeScroll() {
            try {
              var el = document.querySelector('.Md3f7G_scroll')
              if (el !== null && typeof el.scrollHeight === 'number') el.scrollTop = el.scrollHeight
            } catch (err) {}
          }
          function applyInset(value) {
            if (value === null) rootEl.style.removeProperty('--dsh-mobile-keyboard-inset')
            else rootEl.style.setProperty('--dsh-mobile-keyboard-inset', value + 'px')
            // Nudge only on open/close transitions (never on pan
            // adjustments while the keyboard stays open — the user is
            // scrolling by hand then).
            if (value !== lastApplied && (value === null || lastApplied === null)) nudgeScroll()
            lastApplied = value
          }
          function syncKeyboard() {
            if (mq !== null && !mq.matches) {
              applyInset(null)
              return
            }
            if (!keyboardContextActive()) {
              applyInset(null)
              return
            }
            // Lift = the layout-viewport band the keyboard covers: layout
            // height minus the visible window, minus any pan offset.
            var inset = Math.max(0, Math.round(win.innerHeight - vv.height - (vv.offsetTop || 0)))
            applyInset(inset > 8 ? inset : null)
          }
          vv.addEventListener('resize', syncKeyboard)
          vv.addEventListener('scroll', syncKeyboard)
          if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            document.addEventListener('focusin', syncKeyboard, true)
            document.addEventListener('focusout', syncKeyboard, true)
          }
          syncKeyboard()
          return function () {
            vv.removeEventListener('resize', syncKeyboard)
            vv.removeEventListener('scroll', syncKeyboard)
            if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
              document.removeEventListener('focusin', syncKeyboard, true)
              document.removeEventListener('focusout', syncKeyboard, true)
            }
            rootEl.style.removeProperty('--dsh-mobile-keyboard-inset')
          }
        }, PACKAGE + ': keyboard inset')
      }

      // Structural discovery + self-marking (Tier 2 of the resilience
      // scheme). The shell columns are found through the documented
      // slot/`data-slot` structure and DOM order, self-checked against the
      // app's inline grid template, then tagged with plugin-owned
      // data-dsh-mobile-* attributes that the stylesheet keys off. The
      // CSS never pins hashed class names for layout, so an upstream
      // re-hash cannot break it; if discovery fails, no marks are written
      // and every layout rule stays inert — the app keeps its official
      // behavior instead of a half-applied phone layout.
      function markStructure() {
        if (typeof document === 'undefined') return null
        var slot = document.querySelector('[data-slot="sidebar"]')
        if (slot === null || slot.parentElement === null || slot.parentElement.parentElement === null) return null
        var sidebarCol = slot.parentElement
        var frame = sidebarCol.parentElement
        // Self-check 1: the frame is the grid the app drives with an
        // inline gridTemplateColumns (React writes it every render).
        if (frame.style === null || typeof frame.style === 'undefined' || typeof frame.style.gridTemplateColumns !== 'string') return null
        // DOM order contract: sidebar | center | details | shell overlay.
        var centerCol = sidebarCol.nextElementSibling
        if (centerCol === null) return null
        var detailsCol = centerCol.nextElementSibling
        // Self-check 2: the third column must not be the shell overlay
        // node (data-shell-overlay marks it); a broken chain marks nothing.
        if (detailsCol === null || (typeof detailsCol.hasAttribute === 'function' && detailsCol.hasAttribute('data-shell-overlay'))) detailsCol = null

        frame.setAttribute('data-dsh-mobile-frame', '')
        sidebarCol.setAttribute('data-dsh-mobile-sidebar-col', '')
        centerCol.setAttribute('data-dsh-mobile-center-col', '')
        if (detailsCol !== null) detailsCol.setAttribute('data-dsh-mobile-details-col', '')
        return { frame, sidebarCol, centerCol, detailsCol, slot }
      }

      // Independent structural-marking effect (no service dependency):
      // publishes the health marker and warns once when the layout tier
      // must degrade. Retries for a few seconds: plugin activation can
      // race the shell's first React commit, so the slot structure may
      // not exist at apply time yet.
      if (typeof document !== 'undefined') {
        ctx.effect(function () {
          var marks = null
          var timer = null
          var attempts = 0
          function publish() {
            if (document.body !== null && typeof document.body !== 'undefined') {
              document.body.setAttribute('data-dsh-mobile-layout', marks === null ? 'degraded' : 'ok')
            }
          }
          function tryMark() {
            marks = markStructure()
            if (marks !== null) {
              publish()
              return
            }
            publish()
            attempts += 1
            if (attempts < 20) {
              timer = setTimeout(tryMark, 150)
            } else {
              try {
                console.info(PACKAGE + ': shell structure not discovered — layout adaptation disabled (theme layer still active)')
              } catch (err) {}
            }
          }
          tryMark()
          return function () {
            if (timer !== null) clearTimeout(timer)
          }
        }, PACKAGE + ': structural marks')
      }

      // Phone layout gate shared by the keyboard guard: true exactly when
      // the drawer CSS is active (computed style — the stylesheet's own
      // authority, never matchMedia).
      function phoneLayout() {
        if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return false
        var col = document.querySelector('[data-dsh-mobile-sidebar-col]')
        if (col === null) return false
        try {
          return getComputedStyle(col).position === 'absolute'
        } catch (err) {
          return false
        }
      }

      // Composer keyboard guard: the official composer focuses itself
      // whenever sessionId changes — a desktop convenience that pops the
      // keyboard on phones. The guard suppresses ONLY the two scenarios it
      // exists for: the initial mount (no user input yet) and a session
      // switch just triggered from the drawer. Everything else — above all
      // the send-flow refocus the app performs after a submit — passes
      // through untouched: blurring it mid-send churned the viewport
      // geometry and stranded the official at-bottom state (the "new
      // message" pill overlapping the previous turn's tool tail).
      if (typeof document !== 'undefined') {
        ctx.effect(function () {
          var lastIntentAt = 0
          function onPointerDown(e) {
            // Any pointerdown marks the page as user-interactive.
            pageTouchedAt = Date.now()
            if (!phoneLayout()) return
            var col = document.querySelector('[data-dsh-mobile-center-col]')
            var inside = col !== null && typeof col.contains === 'function' && col.contains(e.target)
            lastIntentAt = inside ? Date.now() : 0
          }
          function onFocusIn(e) {
            if (!phoneLayout()) return
            var t = e && e.target !== void 0 ? e.target : null
            if (t === null || typeof t.tagName !== 'string' || t.tagName.toUpperCase() !== 'TEXTAREA') return
            var col = document.querySelector('[data-dsh-mobile-center-col]')
            if (col === null || typeof col.contains !== 'function' || !col.contains(t)) return
            // A real tap on the composer is always allowed.
            if (Date.now() - lastIntentAt <= 500) return
            var initialMount = pageTouchedAt === 0
            var drawerSwitch = Date.now() - recentDrawerTapAt < 1500
            if (!initialMount && !drawerSwitch) return
            try { t.blur() } catch (err) {}
          }
          document.addEventListener('pointerdown', onPointerDown, true)
          document.addEventListener('touchstart', onPointerDown, true)
          document.addEventListener('focusin', onFocusIn, true)
          return function () {
            document.removeEventListener('pointerdown', onPointerDown, true)
            document.removeEventListener('touchstart', onPointerDown, true)
            document.removeEventListener('focusin', onFocusIn, true)
          }
        }, PACKAGE + ': composer keyboard guard')
      }

      // Tap-to-reveal for the message time/stats labels — the touch
      // analogue of the official hover-reveal. A tap on a message toggles
      // its labels for ~4s; tapping anywhere else hides them all. Taps on
      // the action buttons themselves do not toggle (they are button
      // actions, not message touches).
      if (typeof document !== 'undefined') {
        ctx.effect(function () {
          var revealTimer = null
          function clearTimer() {
            if (revealTimer !== null) {
              clearTimeout(revealTimer)
              revealTimer = null
            }
          }
          function hideAll(except) {
            var items = document.querySelectorAll('[data-dsh-mobile-times="1"]')
            for (var i = 0; i < items.length; i++) {
              if (except === void 0 || items[i] !== except) items[i].removeAttribute('data-dsh-mobile-times')
            }
          }
          function onTap(e) {
            var t = e && e.target !== void 0 ? e.target : null
            if (t === null || typeof t.closest !== 'function') {
              hideAll()
              clearTimer()
              return
            }
            // Action buttons keep their own behavior.
            if (t.closest('.p-xYUq_actions') !== null) return
            // User messages have nothing to reveal (their send time is
            // always visible): never mark them — just collapse any other
            // revealed row, so the mark can never clip the user time.
            if (t.closest('.gdEzaW_userRow') !== null) {
              hideAll()
              clearTimer()
              return
            }
            var item = t.closest('.Md3f7G_flowItem')
            if (item === null) {
              hideAll()
              clearTimer()
              return
            }
            var wasShown = item.getAttribute('data-dsh-mobile-times') === '1'
            hideAll(item)
            clearTimer()
            if (wasShown) {
              item.removeAttribute('data-dsh-mobile-times')
            } else {
              item.setAttribute('data-dsh-mobile-times', '1')
              revealTimer = setTimeout(function () {
                item.removeAttribute('data-dsh-mobile-times')
                revealTimer = null
              }, 4000)
            }
          }
          document.addEventListener('click', onTap, true)
          return function () {
            document.removeEventListener('click', onTap, true)
            clearTimer()
            hideAll()
          }
        }, PACKAGE + ': message time tap-reveal')
      }

      // Drawer behavior + ☰ / settings floating buttons (enhancement;
      // layout is optional). The buttons live at body level — outside
      // every React container — so no reconciliation can wipe them. CSS
      // shows them only on phones; the header reserves their slots.
      var layout = null
      try {
        layout = ctx.get('layout')
      } catch (err) {
        layout = null
      }
      if (layout !== null && typeof layout.toggleSidebar === 'function' && typeof document !== 'undefined') {
        ctx.effect(function () {
          // Deferred init: the slot structure may not exist yet when apply
          // runs (activation races the shell's first commit). Retry for a
          // few seconds, then give up silently — never fail the fiber.
          var cleanup = function () {}
          var timer = null
          var attempts = 0
          function tryInit() {
            var m = markStructure()
            if (m !== null) {
              cleanup = initDrawer(m)
              return
            }
            attempts += 1
            if (attempts < 20) timer = setTimeout(tryInit, 150)
          }
          tryInit()
          return function () {
            if (timer !== null) clearTimeout(timer)
            cleanup()
          }
        }, PACKAGE + ': drawer + fab behavior')

        function initDrawer(marks) {
          var frame = marks.frame
          var slot = marks.slot
          var sidebarCol = marks.sidebarCol

          function appIsZh() {
            var docLang = typeof document.documentElement === 'object' && document.documentElement !== null
              ? (document.documentElement.lang || document.documentElement.getAttribute('lang') || '')
              : ''
            return docLang.toLowerCase().indexOf('zh') === 0
          }

          function appendFab(className, label, html, onClick) {
            if (typeof document.body === 'undefined' || document.body === null) return null
            var btn = document.createElement('button')
            btn.type = 'button'
            btn.className = className
            btn.setAttribute('aria-label', label)
            btn.innerHTML = html
            btn.addEventListener('click', onClick)
            document.body.appendChild(btn)
            return btn
          }

          function isFabTarget(t) {
            if (t == null) return false
            if (fab !== null && (t === fab || (typeof fab.contains === 'function' && fab.contains(t)))) return true
            if (settingsFab !== null && (t === settingsFab || (typeof settingsFab.contains === 'function' && settingsFab.contains(t)))) return true
            return false
          }

          function openSettings() {
            var trigger = null
            try {
              trigger = document.querySelector('[data-slot="sidebar"] button[aria-haspopup="dialog"]')
            } catch (err) {
              trigger = null
            }
            if (trigger !== null && typeof trigger.click === 'function') trigger.click()
          }

          var fab = null
          var settingsFab = null
          fab = appendFab(
            'dsh-mobile-theme-fab',
            appIsZh() ? '切换侧栏' : 'Toggle sidebar',
            '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14"/></svg>',
            function () { layout.toggleSidebar() }
          )
          if (fab !== null) fab.setAttribute('aria-expanded', 'false')
          settingsFab = appendFab(
            'dsh-mobile-theme-settings-fab',
            appIsZh() ? '设置' : 'Settings',
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
            openSettings
          )
          if (settingsFab !== null) settingsFab.setAttribute('aria-haspopup', 'dialog')

          var historyApi = win !== null && win.history &&
            typeof win.history.pushState === 'function' && typeof win.history.back === 'function'
          var pushed = null // 'sidebar' | 'details' | null — our marked entry

          function expanded() {
            return frame !== null && !frame.hasAttribute('data-sidebar-collapsed')
          }

          function detailsOpen() {
            return frame !== null && !frame.hasAttribute('data-details-collapsed')
          }

          // Drawer mode: true exactly when OUR overlay CSS is active, read
          // from the computed style of the marked sidebar column (position:
          // absolute ⇔ the phone drawer rules apply). Same authority as
          // the stylesheet itself, so it can never disagree with what the
          // user sees — unlike matchMedia, which some WebViews evaluate
          // differently between CSS and JS.
          function drawerMode() {
            if (sidebarCol === null || typeof getComputedStyle !== 'function') return false
            try {
              return getComputedStyle(sidebarCol).position === 'absolute'
            } catch (err) {
              return false
            }
          }

          function closeDrawer() {
            if (!drawerMode()) return
            if (!expanded()) return
            layout.toggleSidebar()
          }

          // Shared dismiss logic. `now` marks the action timestamp so the
          // companion click event (fired right after pointerup) is deduped.
          var lastTapActionAt = 0

          // Official overlay semantics (verified in the shell sources):
          // every modal Dialog renders aria-modal="true"; every popover /
          // dropdown / select menu renders role="menu" (Menu component,
          // including its body-level portal variant). While any of them is
          // open, taps belong to the overlay's own interaction — the drawer
          // sits behind it and must not react.
          function overlayOpen() {
            if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return false
            try {
              return document.querySelector('[aria-modal="true"], [role="menu"]') !== null
            } catch (err) {
              return false
            }
          }

          function handleTap(e) {
            if (!drawerMode()) return
            if (!expanded()) return
            var t = e && e.target !== void 0 ? e.target : null
            // The ☰ / settings buttons toggle themselves; never treat them as a dismiss.
            if (isFabTarget(t)) return
            // Whitelist inside the drawer: ONLY navigation rows close it
            // (session rows, search results that jump to a session, and the
            // new-session button). Every other control — search input,
            // settings, tools, project rows, the drawer's own toggle —
            // keeps the drawer open. The close is deferred past React's
            // handling of the tap; the toggle's own close has already
            // flipped the attribute by then, so no double toggle either.
            if (slot !== null && slot.contains(t)) {
              lastTapActionAt = Date.now()
              // Any inside tap marks the drawer-switch window for the
              // keyboard guard (session switches refocus the composer).
              recentDrawerTapAt = Date.now()
              var navRow = t !== null && typeof t.closest === 'function'
                ? t.closest('.YDXeBa_sessionRow, .YDXeBa_searchResultRow, .hHd-Xa_newSession')
                : null
              if (navRow === null) return
              setTimeout(function () {
                if (overlayOpen()) return
                closeDrawer()
              }, 250)
              return
            }
            // Outside the drawer: the mask / center column dismisses it —
            // unless an official overlay (modal dialog or popover menu) is
            // open above the mask; those taps belong to the overlay's own
            // interaction and must not touch the drawer. Hit-testing against
            // the ::before mask is unreliable across WebViews, which is why
            // this branch stays inverted (any outside target dismisses).
            if (overlayOpen()) return
            lastTapActionAt = Date.now()
            closeDrawer()
          }

          // pointerup is the primary dismiss channel: some WebViews (e.g.
          // WeChat X5) never synthesize `click` for taps that land on a
          // ::before pseudo-element background. click stays as the fallback
          // for engines without pointer events (old iOS), deduped by time.
          function onPointerUp(e) {
            handleTap(e)
          }

          function onClick(e) {
            if (Date.now() - lastTapActionAt < 350) return
            handleTap(e)
          }

          function onKey(e) {
            if (e.key === 'Escape') closeDrawer()
          }

          // Android back gesture. popstate carries the state of the entry
          // the navigation LANDED on — not the popped one — so the signal
          // is "did we navigate away from our drawer entry": the pushed
          // flag marks that we own the current history step. Landing back
          // ON a marker (an app entry popped above ours) keeps the drawer.
          function onPopState(e) {
            if (!historyApi || pushed === null) return
            var marker = e && e.state ? e.state.dshMobileTheme : null
            if (marker === 'sidebar') {
              // An entry above the sidebar was popped; if that was the
              // details drawer's entry, close the details overlay.
              if (pushed === 'details' && detailsOpen() && typeof layout.closeDetails === 'function') layout.closeDetails()
              pushed = 'sidebar'
              return
            }
            if (marker === 'details') return
            // Navigated past our drawer entry: close what we pushed.
            var which = pushed
            pushed = null
            if (which === 'sidebar') {
              if (!drawerMode()) return
              if (expanded()) layout.toggleSidebar()
            } else if (which === 'details') {
              if (detailsOpen() && typeof layout.closeDetails === 'function') layout.closeDetails()
            }
          }

          // Open/close transitions: aria mirror + history bookkeeping.
          var observer = null
          if (frame !== null && typeof MutationObserver === 'function') {
            observer = new MutationObserver(function () {
              var sidebarOpen = expanded()
              var detailsOpenNow = detailsOpen()
              if (fab !== null) fab.setAttribute('aria-expanded', sidebarOpen ? 'true' : 'false')
              if (!historyApi) return

              if (drawerMode()) {
                if (sidebarOpen && pushed === null) {
                  win.history.pushState({ dshMobileTheme: 'sidebar' }, '')
                  pushed = 'sidebar'
                } else if (detailsOpenNow && pushed === null) {
                  win.history.pushState({ dshMobileTheme: 'details' }, '')
                  pushed = 'details'
                }
              }
              // UI-driven closes consume our entry (a back-navigation
              // already cleared `pushed` in onPopState, so never double).
              if (!sidebarOpen && pushed === 'sidebar') {
                pushed = null
                win.history.back()
              }
              if (!detailsOpenNow && pushed === 'details') {
                pushed = null
                win.history.back()
              }
            })
            observer.observe(frame, { attributes: true, attributeFilter: ['data-sidebar-collapsed', 'data-details-collapsed'] })
          }

          document.addEventListener('pointerup', onPointerUp, true)
          document.addEventListener('click', onClick, true)
          document.addEventListener('keydown', onKey, true)
          if (win !== null && historyApi) win.addEventListener('popstate', onPopState)

          // Re-mark on child-list churn: if an upstream change unmounts and
          // remounts a column (e.g. a lazy details panel), the attributes
          // are re-applied and the captured references refreshed; if the
          // structure no longer verifies, the old marks stay and the rules
          // keep working off the surviving nodes.
          var remarker = null
          if (frame !== null && typeof MutationObserver === 'function') {
            remarker = new MutationObserver(function () {
              var again = markStructure()
              if (again !== null) {
                frame = again.frame
                slot = again.slot
                sidebarCol = again.sidebarCol
              }
            })
            remarker.observe(frame, { childList: true, subtree: true })
          }

          return function () {
            document.removeEventListener('pointerup', onPointerUp, true)
            document.removeEventListener('click', onClick, true)
            document.removeEventListener('keydown', onKey, true)
            if (win !== null && historyApi) win.removeEventListener('popstate', onPopState)
            if (observer !== null && typeof observer.disconnect === 'function') observer.disconnect()
            if (remarker !== null && typeof remarker.disconnect === 'function') remarker.disconnect()
            if (fab !== null && fab.parentNode !== null) fab.parentNode.removeChild(fab)
            if (settingsFab !== null && settingsFab.parentNode !== null) settingsFab.parentNode.removeChild(settingsFab)
          }
        }
      }
    }

    exports.apply = apply
    exports.inject = ['theme']
    return module.exports
  }
})
