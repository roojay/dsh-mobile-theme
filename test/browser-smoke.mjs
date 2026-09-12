/** Real DSH Web composition, isolated home, no credentials or successful model calls. */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const dsh = process.env.DSH_BIN || resolve(root, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
const scratch = await mkdtemp(resolve(tmpdir(), 'dsh-mobile-smoke-'))
const workspace = resolve(scratch, 'workspace')
await mkdir(workspace)
await writeFile(resolve(workspace, 'README.md'), '# Mobile preview fixture\n\nLocal compatibility test.\n')
const env = { ...process.env, DSH_HOME: resolve(scratch, 'home'), DEEPSEEK_API_KEY: '', DEEPSEEK_BASE_URL: 'http://127.0.0.1:1' }
const run = args => new Promise((done, fail) => {
  const child = spawn(process.execPath, [dsh, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', data => { output += data })
  child.stderr.on('data', data => { output += data })
  child.once('error', fail)
  child.once('exit', code => code === 0 ? done() : fail(new Error(output)))
})
await run(['plugin', '--profile', 'web', 'add', `dsh-mobile-theme@file:${root}`])
const server = spawn(process.execPath, [dsh, 'web', '--host', '127.0.0.1', '--port', '0', '--no-open'], { env })
let browser
try {
  const url = await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error('DSH Web did not start')), 30_000)
    let output = ''
    server.stdout.on('data', data => {
      output += data
      const match = output.match(/dsh web: (http[^\s]+)/)
      if (match) { clearTimeout(timer); done(match[1]) }
    })
    server.once('error', fail)
    server.once('exit', code => { clearTimeout(timer); fail(new Error(`DSH exited: ${code}`)) })
  })
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE,
    args: process.env.CHROMIUM_ARGS ? JSON.parse(process.env.CHROMIUM_ARGS) : ['--no-sandbox']
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  page.setDefaultTimeout(10_000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Configure later', exact: true }).click()
  await page.waitForFunction(() => document.body.dataset.dshMobileLayout === 'ok')
  await page.getByRole('button', { name: 'Choose workspace', exact: true }).click()
  const directory = page.getByRole('dialog')
  assert.ok((await directory.boundingBox()).height > 750, 'late-loaded directory CSS stays overridden')
  assert.equal(await page.locator('.dsh-mobile-theme-fab').isVisible(), false, 'FAB does not cover dialogs')
  await page.getByRole('button', { name: 'Edit path', exact: true }).click()
  await page.getByRole('textbox', { name: 'Edit path' }).fill(workspace)
  await page.getByRole('textbox', { name: 'Edit path' }).press('Enter')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.locator('[data-composer-input][contenteditable=true]').fill('Local offline compatibility fixture')
  await page.locator('[data-composer-input]').press('Enter')
  // A real session is created; the missing key terminates the turn before any provider request.
  await page.getByText('MISSING_CREDENTIAL', { exact: true }).waitFor()
  await page.locator('[data-composer-input]').blur()

  for (const [width, height] of [[320, 740], [390, 844], [844, 390], [768, 1024], [1440, 900]]) {
    const phone = width <= 767 || (width <= 900 && height <= 500)
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(350)
    const geometry = await page.evaluate(() => {
      const center = document.querySelector('[data-dsh-mobile-center-col]')
      const input = document.querySelector('[data-composer-input]')
      const send = document.querySelector('button[aria-label="Send message"]')
      return { center: center.getBoundingClientRect().toJSON(), send: send.getBoundingClientRect().toJSON(),
        input: input.getBoundingClientRect().toJSON(), page: document.documentElement.scrollWidth, viewport: innerWidth,
        font: parseFloat(getComputedStyle(input).fontSize) }
    })
    assert.ok(geometry.page <= geometry.viewport + 1, `no document overflow at ${width}`)
    if (phone) {
      assert.ok(Math.abs(geometry.center.width - width) < 2, `full-width center at ${width}`)
      assert.ok(geometry.send.right <= width + 1 && geometry.send.left >= 0, `send stays visible at ${width}`)
      assert.ok(geometry.font >= 16)
    }
    assert.equal(await page.locator('.dsh-mobile-theme-fab').isVisible(), phone)
    console.log(`viewport ${width}x${height}: passed`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(350)
  await page.locator('[data-sidebar-right-expand]').click()
  await page.waitForTimeout(350)
  const panel = page.locator('[data-sidebar-right-panel]')
  assert.ok(await panel.getAttribute('data-sidebar-right-open'))
  assert.equal(Math.round((await panel.boundingBox()).width), 390)
  assert.equal(await page.locator('.dsh-mobile-theme-fab').isVisible(), false)
  await page.getByText('README.md', { exact: true }).click()
  await page.getByRole('heading', { name: 'Mobile preview fixture' }).waitFor()
  await page.goBack()
  await page.waitForFunction(() => !document.querySelector('[data-sidebar-right-panel][data-sidebar-right-open]'))
  await page.locator('[data-sidebar-right-expand]').click()
  await page.locator('[data-sidebar-right-toggle]').click()
  await page.waitForFunction(() => !document.querySelector('[data-sidebar-right-panel][data-sidebar-right-open]'))
  await page.locator('.dsh-mobile-theme-fab').click()
  await page.locator('[data-slot="sidebar.settings"] button[aria-haspopup="dialog"]').click()
  const settings = page.getByRole('dialog')
  assert.equal(Math.round((await settings.boundingBox()).width), 320)
  assert.equal(await page.locator('.dsh-mobile-theme-fab').isVisible(), false)
  await settings.getByRole('button', { name: 'Close', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[data-dsh-mobile-frame]').hasAttribute('data-sidebar-collapsed'))
  const installed = resolve(env.DSH_HOME, 'profiles/web/node_modules/dsh-mobile-theme/lib/client.js')
  const replacement = (await readFile(installed, 'utf8')).replace('var VERSION = "0.5.0"', 'var VERSION = "0.5.0-smoke-hmr"')
  await writeFile(installed + '.next', replacement)
  await rename(installed + '.next', installed)
  await page.waitForFunction(() => document.body.dataset.dshMobileTheme === '0.5.0-smoke-hmr')
  assert.equal(await page.locator('.dsh-mobile-theme-fab').count(), 1, 'HMR leaves one menu button')
  assert.equal(await page.locator('style[data-plugin-css="dsh-mobile-theme/client.css"]').count(), 1)
  await page.locator('.dsh-mobile-theme-fab').click()
  await page.waitForFunction(() => !document.querySelector('[data-dsh-mobile-frame]').hasAttribute('data-sidebar-collapsed'))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('[data-dsh-mobile-frame]').hasAttribute('data-sidebar-collapsed'))
  assert.deepEqual(errors, [])
  console.log('real DSH composition: directory, Lexical, preview, Back, native close, settings, HMR and 5 viewports passed')
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
