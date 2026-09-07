import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const bundle = readFileSync(resolve(root, 'lib/client.js'), 'utf8')

test('built bundle embeds the stylesheet and token table', () => {
  assert.ok(!bundle.includes('__DSH_MOBILE_THEME_CSS__'), 'css placeholder must be substituted')
  assert.ok(!bundle.includes('__DSH_MOBILE_THEME_TOKENS__'), 'token placeholder must be substituted')
  assert.ok(bundle.includes('window.__ModuleLoader__.load'), 'bundle must register through the module loader')
  assert.ok(bundle.includes("id: 'dsh-mobile-theme'"), 'bundle id must be the package name')
  assert.ok(bundle.includes('(max-width: 767px)'), 'mobile breakpoint must be embedded')
})

test('built bundle is syntactically valid JavaScript', () => {
  // Syntax-only check: Function constructor parses the body.
  assert.doesNotThrow(() => new Function(bundle))
})

test('embedded stylesheet keeps the structural and pinned selectors', () => {
  // The build JSON-escapes the css; a plain match on the raw fragment works
  // for the selector text (no quotes involved in these fragments).
  for (const fragment of [
    '@media (max-width: 767px)',
    '@media (max-width: 900px) and (max-height: 500px)',
    'grid-template-columns: minmax(0, 1fr) 0px 0px !important',
    '.dsh-mobile-theme-fab',
    '[data-dsh-mobile-sidebar-col]:has([role=\\"dialog\\"][aria-modal=\\"true\\"])',
    'env(safe-area-inset-bottom, 0px)',
    '@media (hover: none)',
    '@media (prefers-reduced-motion: reduce)',
    'touch-action: manipulation',
    '--dsh-mobile-keyboard-inset',
    // Tier 2: layout-critical rules key off runtime-discovered marks —
    // the contract that survives upstream CSS-module re-hashing.
    '[data-dsh-mobile-frame]:not([data-sidebar-collapsed])',
    '[data-dsh-mobile-frame]:not([data-details-collapsed])',
    '[data-dsh-mobile-sidebar-col]',
    '[data-dsh-mobile-center-col]',
    '[data-dsh-mobile-details-col]',
    '[data-dsh-mobile-center-col] [data-slot=\\"conversation\\"] > *',
    // Tier 3: cosmetic tweaks pinned to the 0.1.0-rc.6 class hashes
    // (concentrated here; their failure mode is cosmetic only).
    '.pI_x6G_handle',
    '.VOzbGW_panel',
    '.VOzbGW_overlay.VOzbGW_overlay',
    '[role=\\"dialog\\"][aria-modal=\\"true\\"] > nav',
    '.VOzbGW_nav.VOzbGW_nav',
    '.uV2eYG_primary',
    '.o3BgMG_inspectButton',
    '.ydkMvW_close',
    '.ZuhsRW_dialog',
    '._G5b-a_modalAction',
    '.Nqubda_panel',
    '.nLMEza_bar',
    '.oY77xG_selector',
    '.QsffPG_menu',
    '.p-xYUq_timeStart',
    '[data-dsh-mobile-times=\\"1\\"] .p-xYUq_timeStart',
    '.YDXeBa_sessionRow',
    '.YDXeBa_searchResultRow',
    '.hHd-Xa_newSession',
    '._copyButton_10eou_142::after',
    '._copyButton_srovd_22::after'
  ]) {
    assert.ok(bundle.includes(fragment), `stylesheet must contain: ${fragment}`)
  }

  // The settings content column must be vertically shrinkable, otherwise
  // long sections overflow the fullscreen sheet and cannot scroll at all
  // (the panel clips them via overflow: hidden).
  assert.match(
    bundle,
    /\.VOzbGW_content\s*\{[^}]*min-height:\s*0/,
    'settings content column must set min-height: 0'
  )
})

test('embedded tokens are { light, dark } pairs with --dsw-* names', () => {
  const match = bundle.match(/var TOKENS = (\{[\s\S]*?\})\n\n/)?.[1]
  assert.ok(match, 'token table must be embedded')
  const tokens = JSON.parse(match)
  assert.ok(Object.keys(tokens).length >= 9, 'token table must carry the mobile palette')
  for (const [name, modes] of Object.entries(tokens)) {
    assert.ok(name.startsWith('--dsw-'), `token name must be a --dsw-* property: ${name}`)
    assert.equal(typeof modes.light, 'string', `${name} light value`)
    assert.equal(typeof modes.dark, 'string', `${name} dark value`)
  }
})

test('runtime version marker matches package.json (single source of truth)', () => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  assert.ok(bundle.includes(`var VERSION = ${JSON.stringify(pkg.version)}`), 'bundle carries the package version')
})
