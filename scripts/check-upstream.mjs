/** Verify cosmetic locals against the CSS shipped by the installed DSH release. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const modules = resolve(process.env.DSH_NODE_MODULES || resolve(root, 'node_modules'))
const owners = JSON.parse(readFileSync(resolve(root, 'src/selectors.json'), 'utf8'))
const source = ['src/client.css', 'src/client.template.js'].map(path =>
  readFileSync(resolve(root, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')).join('\n')
const sheets = new Map()
for (const tag of Object.values(owners)) {
  const pkg = tag.slice(0, tag.lastIndexOf('/'))
  if (sheets.has(tag)) continue
  const manifest = JSON.parse(readFileSync(resolve(modules, pkg, 'package.json'), 'utf8'))
  assert.equal(manifest.version, '0.1.5-rc.2', `${pkg} release`)
  const bundle = readFileSync(resolve(modules, pkg, 'lib/client.js'), 'utf8')
  for (const m of bundle.matchAll(/const css\$?\w* = ("(?:[^"\\]|\\.)*");\s*const tagId\$?\w* = ("(?:[^"\\]|\\.)*");/g)) {
    sheets.set(JSON.parse(m[2]), JSON.parse(m[1]))
  }
}
const aliases = new Set([...source.matchAll(/\.dsh-([A-Za-z0-9]+)_([A-Za-z0-9_]+)/g)].map(m => m[1] + '_' + m[2]))
for (const alias of aliases) {
  const split = alias.indexOf('_')
  const owner = alias.slice(0, split), local = alias.slice(split + 1)
  const css = sheets.get(owners[owner])
  assert.ok(css, `${owners[owner]} must be shipped`)
  assert.match(css, new RegExp('\\.[\\w-]+_' + local + '(?![\\w-])'), alias)
}
console.log(`DSH 0.1.5-rc.2: ${aliases.size} cosmetic selectors verified against published bundles`)
