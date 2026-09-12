# DSH 0.1.5-rc.2 compatibility

Analysis date: 2026-09-12. Plugin base: `fa6513bff5ce2162c821b48da143ae3116c1e8d0` (0.4.7); updated package: 0.5.0.

## Evidence

- [Latest release: dsh-v0.1.5-rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-rc.2), published 2026-09-10, release commit `fb2c4b9e698e30edb738bca4cf0618587db7d203`.
- [Master inspected](https://github.com/deepseek-ai/deepseek-harness/commit/c291e7961a515f6d7af9304e7fd1d257929aef26): `c291e7961a515f6d7af9304e7fd1d257929aef26`, 2026-09-10. The source inspection and published-package tests are separate checks.
- The real Web smoke uses the official `@deepseek-ai/dsh@0.1.5-rc.2` npm distribution, installed in a separate runtime. Both peer packages are pinned to that version; this is a prerelease, published under `next` at the time of inspection.

## Source changes and adaptation

All source links below pin the inspected master commit.

| Upstream surface | Finding | Plugin adaptation |
|---|---|---|
| [AppFrame](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/src/client/AppFrame.tsx) | Columns are sidebar/main/rightbar; `main` selects the conversation key. CSSOM serializes the zero as `0px`. | Validate actual column slots and normalized grid text; clear old marks on failed validation/remount. |
| [Right Sidebar](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-sidebar-right/src/client/shell/SidebarRight.tsx) | Fullscreen below 768px can have no grid track while content is open. The content owner exposes `data-sidebar-right-panel` and `data-sidebar-right-open`. | Observe content visibility instead of `data-rightbar-collapsed`; use an untransformed containing column and fullscreen phone/landscape presentation. |
| [Sidebar service](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-sidebar-right/src/client/service.ts) | `sidebarRight.isExpanded()` / `toggleExpanded()` own expansion. Layout's `closeRightbar()` only reports geometry. | Back and Escape use the owner; do not use the removed Details API or a layout-only close. Reuse the history step when moving between drawers. |
| [Lexical host](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-conversation/src/client/input/editor/ComposerContentEditable.tsx) | Composer is `div[data-composer-input][contenteditable]`, not a textarea. | Extend focus/keyboard handling to contenteditable, keep intentional taps, avoid pinch-zoom lift, and preserve a reader's position. |
| [Conversation root](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx) | `main` contains a `main.conversation` display-contents wrapper; the real scroll owner is `[data-conversation-scroll]`. | Put keyboard padding on the actual phase root containing the composer, and use the scroll-owner attribute. |
| [InputBar](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx) | Model/send controls now occupy a trailing group; file attachments use a slot. | Allow both tool groups to shrink without clipping permission popovers; retain a visible send target and align Lexical placeholder padding. |
| [CSS bundling](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/tsdown.client.ts) | Dynamic styles carry package/basename `data-plugin-css` tags and `[hash]_[local]` names. Lazy packages may inject styles later. | Resolve cosmetic aliases by exact stylesheet owner and local name; refresh for late loads/HMR and keep overrides last in the head. |
| [Feedback dialog](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-message-feedback/src/client/FeedbackDialog.tsx) | Confirmation dialog replaces immediate feedback. | Bound the dialog to the viewport and enlarge controls; preserve native submission/error handling. |

The old stylesheet's frozen ChatView/MessageItem/MessageIconActions hashes no longer match the release. The manifest's peers were 0.1.2-rc.1, while CI still expected 0.1.1-rc.2. Both are updated, and CI now checks the actual published DSH artifacts and Web composition.

## Reproduce validation

```sh
npm test
npm install --ignore-scripts --no-package-lock --no-save @deepseek-ai/dsh@0.1.5-rc.2 playwright@1.62.1 pnpm@11.19.0
npm run check:upstream
npx playwright install chromium
npm run test:browser
npm pack --dry-run
```

For an existing separate DSH installation, set `DSH_NODE_MODULES` for the selector check and `DSH_BIN` to its `lib/bin.js` for the browser smoke. `PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE` and JSON `CHROMIUM_ARGS` can select a preinstalled browser runtime.

The browser test always creates a temporary DSH home and workspace. It installs this checkout through the official plugin command. The test session deliberately fails with `MISSING_CREDENTIAL` before any provider request; no successful model call is part of this test. It opens an actual Markdown file, exercises native panel services and browser history, and replaces only its temporary installed bundle for the HMR check.

## Verification recorded for this change

| Check | Result |
|---|---|
| Node behavior/build suites | 32 passed |
| Published DSH stylesheet locals | 79 verified |
| Real Web viewports | 320×740, 390×844, 844×390, 768×1024, 1440×900 passed |
| Real composition | Directory picker, editable composer, full-width chat, visible send control, Markdown preview, browser Back, native preview close, drawer-width Settings and HMR passed |
| Browser uncaught exceptions | None during the smoke |

Physical Android/iOS keyboards, IME composition, safe-area insets and OS back gestures remain manual checks in [REGRESSION.md](REGRESSION.md). Chromium viewport emulation establishes layout and interaction behavior, not device certification.
