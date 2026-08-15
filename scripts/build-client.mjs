#!/usr/bin/env node
/**
 * Build the browser bundle: substitutes the stylesheet and the theme token
 * table into the module-loader template and writes lib/client.js.
 *
 * The client half is served verbatim by the harness (no bundler runs on a
 * tree-out plugin package), so the build step is deliberately dependency
 * free — one JSON escape per embedded artifact.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const CSS_PLACEHOLDER = '__DSH_MOBILE_THEME_CSS__'
const TOKENS_PLACEHOLDER = '__DSH_MOBILE_THEME_TOKENS__'
const VERSION_PLACEHOLDER = '__DSH_MOBILE_THEME_VERSION__'

const css = readFileSync(resolve(root, 'src/client.css'), 'utf8')
const template = readFileSync(resolve(root, 'src/client.template.js'), 'utf8')
const tokens = JSON.parse(readFileSync(resolve(root, 'src/tokens.json'), 'utf8'))
// Single source of truth for the runtime version marker: package.json.
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const version = typeof pkg.version === 'string' && pkg.version.length > 0 ? pkg.version : null
if (version === null) throw new Error('package.json carries no version')

// Tokens cross the runtime validation of ThemeRuntime.overrideTokens:
// every entry must be a { light, dark } pair of strings, and the names are
// consumed as --dsw-* custom properties by the token stylesheets.
for (const [name, modes] of Object.entries(tokens)) {
  if (!name.startsWith('--dsw-')) throw new Error(`token "${name}" must be a --dsw-* custom property`)
  if (typeof modes !== 'object' || modes === null || Array.isArray(modes)) {
    throw new Error(`token "${name}" must map to a { light, dark } pair`)
  }
  if (typeof modes.light !== 'string' || typeof modes.dark !== 'string') {
    throw new Error(`token "${name}" needs string light and dark values`)
  }
}

if (!template.includes(CSS_PLACEHOLDER) || !template.includes(TOKENS_PLACEHOLDER) || !template.includes(VERSION_PLACEHOLDER)) {
  throw new Error('client template is missing a build placeholder')
}

const bundle = template
  .replace(CSS_PLACEHOLDER, JSON.stringify(css))
  .replace(TOKENS_PLACEHOLDER, JSON.stringify(tokens, null, 2))
  .replace(VERSION_PLACEHOLDER, JSON.stringify(version))

mkdirSync(resolve(root, 'lib'), { recursive: true })
writeFileSync(resolve(root, 'lib/client.js'), bundle)
console.log(`dsh-mobile-theme: built lib/client.js v${version} (${bundle.length} bytes, css ${css.length} bytes, ${Object.keys(tokens).length} tokens)`)
