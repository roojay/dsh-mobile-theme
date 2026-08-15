#!/usr/bin/env node
/**
 * Hot-deploy the freshly built client bundle into the running web profile
 * WITHOUT restarting the server.
 *
 * The dsh-client-hmr node half stat-polls every graph bundle's file; when
 * this copy changes, it broadcasts an SSE `rebuilt` frame and connected
 * browsers swap the plugin fiber in place (no page refresh). The profile
 * copy is also what /plugins/dsh-mobile-theme/client.js serves, so even a
 * disconnected tab picks the new bytes up on its next load.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(resolve(root, 'lib/client.js'))
if (bundle.length === 0) throw new Error('lib/client.js is empty — run `npm run build` first')

const dshHome = process.env.DSH_HOME || resolve(process.env.HOME ?? '.', '.dsh')
const profile = process.env.DSH_PROFILE || 'web'
const target = resolve(dshHome, 'profiles', profile, 'node_modules', 'dsh-mobile-theme', 'lib', 'client.js')

if (!existsSync(target)) {
  throw new Error(`profile copy not found: ${target} — install first: dsh plugin --profile ${profile} add "dsh-mobile-theme@file:${root}"`)
}

writeFileSync(target, bundle)
console.log(`dsh-mobile-theme: hot-deployed lib/client.js -> ${target} (${bundle.length} bytes); connected browsers reload the fiber via SSE within the poll interval, no restart`)
