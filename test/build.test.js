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

test('stylesheet targets the current shell, editor, and live module aliases', () => {
  const css = readFileSync(resolve(root, 'src/client.css'), 'utf8')
  for (const selector of ['[data-dsh-mobile-frame]', '[data-dsh-mobile-rightbar-col]',
    '[data-sidebar-right-panel]', '[data-slot="main"]', '[data-composer-input]',
    '.dsh-InputBar_primary', '.dsh-ModelSelect_trigger', '.dsh-SettingsRoot_panel']) {
    assert.ok(css.includes(selector), selector)
  }
  assert.ok(!css.includes('data-details-collapsed'))
  assert.ok(!css.includes('[data-slot="conversation"]'))
  const modules = JSON.parse(readFileSync(resolve(root, 'src/selectors.json'), 'utf8'))
  for (const [, name] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.dsh-([A-Za-z0-9]+)_/g)) assert.ok(modules[name], name)
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-client-ui-layout'], '0.1.5-rc.2')
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-client-ui-theme'], '0.1.5-rc.2')
  assert.ok(!bundle.includes('__DSH_MOBILE_THEME_SELECTORS__'))
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
