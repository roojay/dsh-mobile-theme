import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(resolve(root, 'lib/client.js'), 'utf8')

/** Minimal DOM fakes: only the surface the bundle touches. */
function makeDom() {
  const listeners = []
  const head = { children: [] }

  function stateEl(extra = {}) {
    return {
      attrs: {},
      parentElement: null,
      nextElementSibling: null,
      style: null,
      isConnected: true,
      setAttribute(k, v) { this.attrs[k] = v },
      hasAttribute(k) { return k in this.attrs },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
      contains(node) { return node === this },
      ...extra
    }
  }

  // Shell structure mirror: slot[data-slot=sidebar] inside the sidebar
  // column inside the grid frame, followed by center/details columns.
  const slot = { parentElement: null, contains: (node) => node === slot }
  const col = stateEl() // sidebar column
  const centerCol = stateEl()
  const detailsCol = stateEl()
  const frame = stateEl({ style: { gridTemplateColumns: '56px minmax(0, 1fr) 0px' } })
  slot.parentElement = col
  col.parentElement = frame
  col.nextElementSibling = centerCol
  centerCol.parentElement = frame
  centerCol.nextElementSibling = detailsCol
  detailsCol.parentElement = frame

  const viewport = {
    attrs: { content: 'width=device-width, initial-scale=1' },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
    setAttribute(k, v) { this.attrs[k] = v }
  }

  const styleTags = []
  const markedEls = []
  const scroller = { scrollHeight: 1000, scrollTop: 0 }

  function makeElement(tagName) {
    const elListeners = []
    return {
      tagName,
      dataset: {},
      textContent: '',
      innerHTML: '',
      className: '',
      type: '',
      attrs: {},
      parentNode: null,
      children: [],
      setAttribute(k, v) { this.attrs[k] = v },
      getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
      addEventListener(type, fn) { elListeners.push({ type, fn }) },
      dispatch(type, ev) { for (const l of elListeners.filter((x) => x.type === type)) l.fn(ev ?? {}) },
      appendChild(child) { child.parentNode = this; this.children.push(child); return child },
      removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); child.parentNode = null; return child }
    }
  }

  const body = makeElement('body')
  const rootStyle = {
    props: {},
    setProperty(k, v) { this.props[k] = v },
    removeProperty(k) { delete this.props[k] }
  }

  const document = {
    body,
    documentElement: { style: rootStyle, lang: '', getAttribute(k) { return k === 'lang' ? this.lang : null } },
    activeElement: null,
    head: {
      appendChild(tag) { head.children.push(tag); return tag }
    },
    createElement(tagName) {
      const tag = makeElement(tagName)
      if (tagName === 'style') styleTags.push(tag)
      return tag
    },
    querySelector(selector) {
      if (selector === 'meta[name="viewport"]') return viewport
      if (selector === '[data-slot="sidebar"]') return slot
      if (selector === '[data-dsh-mobile-sidebar-col]') return col
      if (selector === '[data-dsh-mobile-center-col]') return centerCol
      if (selector === '[data-dsh-mobile-details-col]') return detailsCol
      if (selector === '.Md3f7G_scroll') return scroller
      if (selector.startsWith('style[data-plugin-css=')) {
        const wanted = selector.slice(selector.indexOf('"') + 1, selector.lastIndexOf('"'))
        return styleTags.find((t) => t.dataset.pluginCss === wanted) ?? null
      }
      return null
    },
    querySelectorAll(selector) {
      if (selector === '[data-dsh-mobile-times="1"]') {
        return markedEls.filter((el) => typeof el.getAttribute === 'function' && el.getAttribute('data-dsh-mobile-times') === '1')
      }
      return []
    },
    addEventListener(type, fn) { listeners.push({ type, fn }) },
    removeEventListener(type, fn) {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn)
      if (i >= 0) listeners.splice(i, 1)
    }
  }
  return { document, frame, slot, col, centerCol, detailsCol, viewport, styleTags, listeners, body, rootStyle, scroller, markedEls }
}

function makeMediaQuery(initial) {
  const listeners = []
  return {
    matches: initial,
    addEventListener(type, fn) { if (type === 'change') listeners.push(fn) },
    removeEventListener(type, fn) {
      const i = listeners.indexOf(fn)
      if (i >= 0) listeners.splice(i, 1)
    },
    flip(value) { this.matches = value; for (const fn of [...listeners]) fn() }
  }
}

/** window fake: history with faithful back()→popstate semantics, visualViewport, listeners. */
function makeWin() {
  const listeners = []
  const win = {
    innerHeight: 800,
    listeners,
    addEventListener(type, fn) { listeners.push({ type, fn }) },
    removeEventListener(type, fn) {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn)
      if (i >= 0) listeners.splice(i, 1)
    },
    emit(type, ev) { for (const l of listeners.filter((x) => x.type === type)) l.fn(ev) },
    history: {
      stack: [],
      pushState(state) { this.stack.push(state) },
      back() {
        this.stack.pop()
        // The pop lands on the remaining top entry (state may be null).
        win.emit('popstate', { state: this.stack[this.stack.length - 1] ?? null })
      }
    },
    visualViewport: {
      offsetTop: 0,
      height: 800,
      addEventListener(type, fn) { win.listeners.push({ type, fn }) },
      removeEventListener(type, fn) {
        const i = win.listeners.findIndex((l) => l.type === type && l.fn === fn)
        if (i >= 0) win.listeners.splice(i, 1)
      },
      set(offsetTop, height) { this.offsetTop = offsetTop; this.height = height; win.emit('resize') }
    }
  }
  return win
}

function makeMutationObserver() {
  const observers = []
  class MutationObserver {
    constructor(cb) { this.cb = cb; this.observed = null; this.opts = null; observers.push(this) }
    observe(target, opts) { this.observed = target; this.opts = opts ?? null }
    disconnect() { this.observed = null }
    fire() { this.cb() }
  }
  return { MutationObserver, observers }
}

/** The frame attribute observer (aria + history), distinguished from the remarker. */
function findAttrObserver(observers, frame) {
  return observers.find((o) => o.observed === frame && o.opts !== null && Array.isArray(o.opts.attributeFilter))
}

/** Load the bundle in a vm and return its module exports (test hooks attached). */
function loadModule(overrides = {}) {
  let moduleExports = null
  const win = overrides.window ?? makeWin()
  const obs = makeMutationObserver()
  win.__ModuleLoader__ = {
    load(record) { moduleExports = record.factory(() => { throw new Error('no require in tests') }) }
  }
  const sandbox = {
    document: overrides.document,
    matchMedia: overrides.matchMedia ?? (() => { throw new Error('matchMedia must be faked') }),
    getComputedStyle: overrides.getComputedStyle ?? (() => ({ position: 'absolute' })),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: (fn) => globalThis.clearTimeout(fn),
    window: win,
    MutationObserver: obs.MutationObserver,
    console
  }
  vm.createContext(sandbox)
  vm.runInContext(bundle, sandbox, { filename: 'lib/client.js' })
  assert.ok(moduleExports, 'factory must produce module exports')
  Object.defineProperty(moduleExports, '__win', { value: win })
  Object.defineProperty(moduleExports, '__observers', { value: obs.observers })
  return moduleExports
}

function makeTheme() {
  const state = {
    registered: [],
    layers: [],
    disposed: [],
    themes: []
  }
  return {
    state,
    runtime: {
      register(def) { state.registered.push(def); state.themes.push(def) },
      getTheme() { return { themes: state.themes } },
      overrideTokens(source, tokens) {
        state.layers.push({ source, tokens })
        return () => { state.disposed.push(source) }
      }
    }
  }
}

function makeCtx(theme, layout = undefined) {
  const effects = []
  const ctx = {
    theme: theme.runtime,
    effect(fn, label) {
      const disposer = fn() ?? (() => {})
      effects.push({ label, disposer })
      return disposer
    },
    get(name) {
      if (name === 'layout') {
        if (layout === undefined) throw new Error('service not provided')
        return layout
      }
      return undefined
    },
    _effects: effects
  }
  return ctx
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

test('apply injects the stylesheet exactly once and upgrades the viewport meta', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(false) })
  const ctx = makeCtx(theme)

  assert.equal(module.inject.length, 1)
  assert.ok(module.inject.includes('theme'))
  module.apply(ctx)

  const tags = dom.styleTags.filter((t) => t.dataset.plugin === 'dsh-mobile-theme')
  assert.equal(tags.length, 1, 'one plugin style tag')
  assert.equal(tags[0].dataset.pluginCss, 'dsh-mobile-theme/client.css')
  assert.ok(tags[0].textContent.includes('(max-width: 767px)'), 'css payload attached')

  const content = dom.viewport.getAttribute('content')
  assert.ok(content.includes('viewport-fit=cover'), 'safe-area viewport-fit added')
  assert.ok(content.includes('interactive-widget=resizes-content'), 'keyboard resize mode added')
  assert.ok(content.startsWith('width=device-width'), 'existing viewport directives preserved')

  // Version marker: lets a user confirm which bundle is live.
  assert.equal(dom.body.getAttribute('data-dsh-mobile-theme'), '0.3.19')

  // Second apply (HMR re-activation) must not duplicate the style tag.
  module.apply(ctx)
  assert.equal(dom.styleTags.filter((t) => t.dataset.plugin === 'dsh-mobile-theme').length, 1)
})

test('registers the dsh-mobile theme idempotently', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(false) })

  module.apply(makeCtx(theme))
  module.apply(makeCtx(theme))

  assert.equal(theme.state.registered.length, 1, 'duplicate registration must be skipped')
  const def = theme.state.registered[0]
  assert.equal(def.id, 'dsh-mobile')
  assert.equal(def.colorScheme, 'dark')
  assert.ok(Object.keys(def.tokens).length >= 9)
  assert.equal(typeof def.tokens['--dsw-alias-bg-base'], 'string')
})

test('stacks the viewport theme layer while the phone media query matches', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const mq = makeMediaQuery(true)
  const module = loadModule({ document: dom.document, matchMedia: () => mq })
  const ctx = makeCtx(theme)

  module.apply(ctx)
  assert.equal(theme.state.layers.length, 1, 'layer applied on a phone viewport')
  const layer = theme.state.layers[0]
  assert.equal(layer.source, 'dsh-mobile-theme')
  assert.equal(typeof layer.tokens['--dsw-alias-bg-base'].light, 'string')
  assert.equal(typeof layer.tokens['--dsw-alias-bg-base'].dark, 'string')

  mq.flip(false)
  assert.equal(theme.state.disposed.length, 1, 'layer disposed when the viewport widens')

  mq.flip(true)
  assert.equal(theme.state.layers.length, 2, 'layer re-stacked when the viewport narrows')

  // Teardown: disposing the fiber effects removes the media listener and
  // retracts the active layer (no orphaned overrides).
  for (const { disposer } of ctx._effects) disposer()
  assert.equal(theme.state.disposed.length, 2, 'effect teardown retracts the active layer')
  mq.flip(true)
  assert.equal(theme.state.layers.length, 2, 'no re-stack: listener removed by effect disposer')
})

test('closes the expanded drawer on backdrop click, inside tap, and Escape', async () => {
  const dom = makeDom()
  const theme = makeTheme()
  const mq = makeMediaQuery(true)
  let desktopMode = false
  const module = loadModule({
    document: dom.document,
    matchMedia: () => mq,
    getComputedStyle: () => ({ position: desktopMode ? 'static' : 'absolute' })
  })

  let toggles = 0
  const layout = { toggleSidebar() { toggles += 1 } }
  module.apply(makeCtx(theme, layout))

  // ☰ floating button: injected at body level, outside React's tree.
  const fab = dom.body.children.find((c) => c.className === 'dsh-mobile-theme-fab')
  assert.ok(fab, 'floating button injected into document.body')
  assert.equal(fab.getAttribute('aria-label'), 'Toggle sidebar')

  // Expanded: frame lacks the collapsed attribute.
  const fire = (type, target) => {
    const ev = { target }
    for (const l of dom.listeners.filter((l) => l.type === type)) l.fn(ev)
  }
  const tap = (target) => fire('pointerup', target)
  const clickOn = (target) => fire('click', target)
  const key = (value) => {
    for (const l of dom.listeners.filter((l) => l.type === 'keydown')) l.fn({ key: value })
  }

  // pointerup is the primary dismiss channel (WebViews that never
  // synthesize click on ::before masks).
  tap(dom.frame)
  assert.equal(toggles, 1, 'backdrop (frame) tap closes the drawer')

  key('Escape')
  assert.equal(toggles, 2, 'Escape closes the drawer')

  fab.dispatch('click')
  assert.equal(toggles, 3, 'floating button toggles the sidebar')

  // The FAB must never be treated as an outside dismiss.
  tap(fab)
  assert.equal(toggles, 3, 'fab taps are not dismisses')

  // Any target outside the drawer closes it — including portals or
  // elements with higher stacking contexts that steal the hit-test
  // from the mask pseudo-element.
  tap({ tagName: 'div', className: 'stray-portal' })
  assert.equal(toggles, 4, 'stray outside target closes the drawer')

  // Inside the drawer: only navigation rows close it (whitelist).
  const sessionRow = { tagName: 'BUTTON', closest: (sel) => (sel.includes('YDXeBa_sessionRow') ? sessionRow : null) }
  dom.slot.contains = (n) => n === dom.slot || n === sessionRow
  tap(sessionRow)
  assert.equal(toggles, 4, 'session row tap is deferred past React handling')
  await delay(350)
  assert.equal(toggles, 5, 'session row tap closes the drawer after the tick')

  // A non-navigation control inside the drawer keeps it open.
  const searchInput = { tagName: 'INPUT', closest: () => null }
  dom.slot.contains = (n) => n === dom.slot || n === sessionRow || n === searchInput
  dom.frame.attrs = {}
  tap(searchInput)
  await delay(350)
  assert.equal(toggles, 5, 'search input tap keeps the drawer open')

  // Collapsed state: clicks must not toggle.
  dom.frame.attrs['data-sidebar-collapsed'] = true
  tap(dom.frame)
  key('Escape')
  assert.equal(toggles, 5, 'collapsed drawer ignores backdrop/Escape')

  // Desktop width: the drawer CSS is off (computed position static), so
  // dismiss handling must stay silent even if matchMedia disagrees.
  dom.frame.attrs = {}
  mq.flip(false)
  desktopMode = true
  tap(dom.frame)
  key('Escape')
  assert.equal(toggles, 5, 'desktop width ignores drawer handling')
})

test('click fallback dismisses and is deduped after a pointerup action', async () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })

  let toggles = 0
  module.apply(makeCtx(theme, { toggleSidebar() { toggles += 1 } }))

  const fire = (type, target) => {
    for (const l of dom.listeners.filter((l) => l.type === type)) l.fn({ target })
  }

  // Click alone (no pointerup before): fallback path works.
  fire('click', dom.frame)
  assert.equal(toggles, 1, 'click fallback closes the drawer')

  // pointerup acts immediately; the trailing click is deduped.
  fire('pointerup', dom.frame)
  assert.equal(toggles, 2, 'pointerup closes the drawer')
  fire('click', dom.frame)
  assert.equal(toggles, 2, 'trailing click is deduped (no double toggle)')

  // After the dedupe window the click path works again.
  await delay(380)
  fire('click', dom.frame)
  assert.equal(toggles, 3, 'click works again after the dedupe window')
})

test('dismiss path is gated by the drawer CSS, not by matchMedia', () => {
  // Regression: some WebViews evaluate matchMedia differently between CSS
  // and JS. The drawer rules apply (computed position: absolute) while
  // mq.matches reports false — dismiss must still work.
  const dom = makeDom()
  const theme = makeTheme()
  const mq = makeMediaQuery(false) // JS side disagrees with the CSS
  const module = loadModule({
    document: dom.document,
    matchMedia: () => mq,
    getComputedStyle: () => ({ position: 'absolute' }) // drawer CSS active
  })

  let toggles = 0
  module.apply(makeCtx(theme, { toggleSidebar() { toggles += 1 } }))

  const clickOn = (target) => {
    for (const l of dom.listeners.filter((l) => l.type === 'click')) l.fn({ target })
  }
  const key = (value) => {
    for (const l of dom.listeners.filter((l) => l.type === 'keydown')) l.fn({ key: value })
  }

  clickOn({ tagName: 'div', className: 'mask-or-portal' })
  assert.equal(toggles, 1, 'outside click closes even when matchMedia disagrees')

  key('Escape')
  assert.equal(toggles, 2, 'Escape closes even when matchMedia disagrees')
})

test('works without the layout service (CSS + theme layer only, no fab)', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })
  assert.doesNotThrow(() => module.apply(makeCtx(theme, undefined)))
  assert.equal(theme.state.layers.length, 1)
  assert.equal(dom.body.children.length, 0, 'no floating button without the layout service')
})

test('teardown removes document listeners and the floating button', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })
  const ctx = makeCtx(theme, { toggleSidebar() {} })
  module.apply(ctx)
  assert.ok(dom.listeners.some((l) => l.type === 'click'))
  assert.ok(dom.listeners.some((l) => l.type === 'keydown'))
  assert.ok(module.__win.listeners.some((l) => l.type === 'popstate'), 'popstate listener attached')
  assert.equal(dom.body.children.length, 1, 'fab present before teardown')
  for (const { disposer } of ctx._effects) disposer()
  assert.equal(dom.listeners.length, 0, 'all document listeners removed')
  assert.equal(module.__win.listeners.filter((l) => l.type === 'popstate').length, 0, 'popstate listener removed')
  assert.equal(module.__observers.every((o) => o.observed === null), true, 'mutation observer disconnected')
  assert.equal(dom.body.children.length, 0, 'fab removed on teardown')
})

test('mirrors aria-expanded on the floating button via the frame observer', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })
  module.apply(makeCtx(theme, { toggleSidebar() {} }))

  const fab = dom.body.children.find((c) => c.className === 'dsh-mobile-theme-fab')
  assert.equal(fab.getAttribute('aria-expanded'), 'false', 'initial state collapsed')

  const observer = findAttrObserver(module.__observers, dom.frame)
  assert.ok(observer, 'frame observer attached')

  dom.frame.attrs['data-sidebar-collapsed'] = true
  observer.fire()
  assert.equal(fab.getAttribute('aria-expanded'), 'false')

  delete dom.frame.attrs['data-sidebar-collapsed']
  observer.fire()
  assert.equal(fab.getAttribute('aria-expanded'), 'true', 'expanded state mirrored')
})

test('Android back gesture: push on open, pop closes, UI close consumes', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const mq = makeMediaQuery(true)
  const module = loadModule({ document: dom.document, matchMedia: () => mq })

  let sidebarToggles = 0
  let detailsCloses = 0
  const layout = {
    toggleSidebar() { sidebarToggles += 1 },
    closeDetails() { detailsCloses += 1 }
  }
  module.apply(makeCtx(theme, layout))

  const win = module.__win
  const observer = findAttrObserver(module.__observers, dom.frame)

  // Faithful back-gesture simulation: the browser pops the entry, then
  // fires popstate with the state of the entry it landed on.
  const backGesture = () => {
    win.history.stack.pop()
    win.emit('popstate', { state: win.history.stack[win.history.stack.length - 1] ?? null })
  }

  // Open the sidebar: a marked entry is pushed.
  observer.fire()
  assert.equal(win.history.stack.length, 1, 'open pushes one history entry')
  assert.equal(win.history.stack[0].dshMobileTheme, 'sidebar')

  // Back gesture pops our entry and closes the drawer.
  backGesture()
  assert.equal(sidebarToggles, 1, 'back gesture closes the sidebar drawer')
  assert.equal(win.history.stack.length, 0, 'back gesture consumed the entry')

  // Re-open, then close through UI: the entry is consumed (no orphan).
  observer.fire()
  assert.equal(win.history.stack.length, 1)
  dom.frame.attrs['data-sidebar-collapsed'] = true
  observer.fire()
  assert.equal(win.history.stack.length, 0, 'UI close consumes the history entry')
  assert.equal(sidebarToggles, 1, 'consume does not double-toggle')

  // Details drawer: push on open, pop closes it.
  dom.frame.attrs['data-details-collapsed'] = true
  observer.fire()
  delete dom.frame.attrs['data-details-collapsed']
  observer.fire()
  assert.equal(win.history.stack.length, 1, 'details open pushes one entry')
  assert.equal(win.history.stack[0].dshMobileTheme, 'details')

  backGesture()
  assert.equal(detailsCloses, 1, 'back gesture closes the details drawer')

  // Foreign history entries are never intercepted.
  win.emit('popstate', { state: { somethingElse: true } })
  win.emit('popstate', { state: null })
  assert.equal(sidebarToggles, 1)
  assert.equal(detailsCloses, 1)
})

test('visualViewport keyboard: pads the seat only while an editable is focused', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const win = makeWin()
  const mq = makeMediaQuery(true)
  const module = loadModule({ document: dom.document, matchMedia: () => mq, window: win })
  module.apply(makeCtx(theme, { toggleSidebar() {} }))

  const fire = (type) => {
    for (const l of dom.listeners.filter((l) => l.type === type)) l.fn({ target: null })
  }

  // No focused editable: viewport math may be noisy (pinch zoom, toolbar
  // animations) — never lift without a keyboard context, and no scroll
  // nudge on a no-op transition.
  win.visualViewport.set(0, 500)
  assert.equal('--dsh-mobile-keyboard-inset' in dom.rootStyle.props, false, 'no lift without focus')
  assert.equal(dom.scroller.scrollTop, 0, 'no nudge without a transition')

  // Composer focused, keyboard open without layout-viewport shrink:
  // 800 - 500 - 0 = 300px; the open transition nudges the scroller to its
  // floor so the app's at-bottom state recomputes.
  dom.document.activeElement = { tagName: 'TEXTAREA' }
  fire('focusin')
  assert.equal(dom.rootStyle.props['--dsh-mobile-keyboard-inset'], '300px')
  assert.equal(dom.scroller.scrollTop, 1000, 'open transition nudges the scroller')

  // Panned up by 100px while the keyboard stays: 800 - 500 - 100 = 200px.
  // Value-to-value changes must NOT nudge (the user is panning by hand).
  dom.scroller.scrollTop = 0
  win.visualViewport.set(100, 500)
  assert.equal(dom.rootStyle.props['--dsh-mobile-keyboard-inset'], '200px')
  assert.equal(dom.scroller.scrollTop, 0, 'pan adjustment does not nudge')

  // Blur: the lift retracts immediately (close transition nudges again) —
  // no stale value survives the keyboard closing.
  dom.scroller.scrollTop = 0
  dom.document.activeElement = null
  fire('focusout')
  assert.equal('--dsh-mobile-keyboard-inset' in dom.rootStyle.props, false, 'blur retracts the lift')
  assert.equal(dom.scroller.scrollTop, 1000, 'close transition nudges the scroller')

  // Keyboard fully closed while focused: retracted by the math.
  dom.scroller.scrollTop = 0
  dom.document.activeElement = { tagName: 'TEXTAREA' }
  fire('focusin')
  win.visualViewport.set(0, 800)
  assert.equal('--dsh-mobile-keyboard-inset' in dom.rootStyle.props, false)
})

test('marks the shell columns with plugin-owned attributes (no hash pinning)', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })
  module.apply(makeCtx(theme, { toggleSidebar() {} }))

  assert.equal(dom.frame.getAttribute('data-dsh-mobile-frame'), '', 'frame marked')
  assert.equal(dom.col.getAttribute('data-dsh-mobile-sidebar-col'), '', 'sidebar col marked')
  assert.equal(dom.centerCol.getAttribute('data-dsh-mobile-center-col'), '', 'center col marked')
  assert.equal(dom.detailsCol.getAttribute('data-dsh-mobile-details-col'), '', 'details col marked')
  assert.equal(dom.body.getAttribute('data-dsh-mobile-layout'), 'ok', 'layout health marker')
})

test('degrades gracefully when the shell structure no longer verifies', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const mq = makeMediaQuery(true)
  // An upstream change stopped driving the grid with an inline template:
  // discovery must fail loudly (marker) and silently (no marks, no drawer
  // handling) instead of applying a half-broken layout.
  dom.frame.style = {}
  const module = loadModule({ document: dom.document, matchMedia: () => mq })

  let toggles = 0
  module.apply(makeCtx(theme, { toggleSidebar() { toggles += 1 } }))

  assert.equal(dom.frame.getAttribute('data-dsh-mobile-frame'), null, 'no frame mark written')
  assert.equal(dom.col.getAttribute('data-dsh-mobile-sidebar-col'), null, 'no sidebar mark written')
  assert.equal(dom.body.getAttribute('data-dsh-mobile-layout'), 'degraded', 'health marker reports degraded')
  assert.equal(dom.body.children.length, 0, 'no floating button on degraded layout')

  const clickOn = (target) => {
    for (const l of dom.listeners.filter((l) => l.type === 'click')) l.fn({ target })
  }
  clickOn(dom.frame)
  assert.equal(toggles, 0, 'degraded layout has no drawer handling')
})

test('keyboard guard targets only mount and drawer-switch focus', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })
  module.apply(makeCtx(theme, { toggleSidebar() {} }))

  const textarea = { tagName: 'TEXTAREA', blurred: 0, blur() { this.blurred += 1 } }
  dom.centerCol.contains = (n) => n === textarea || n === dom.centerCol

  const fire = (type, target) => {
    for (const l of dom.listeners.filter((l) => l.type === type)) l.fn({ target })
  }

  // Initial mount (no user input yet): suppressed.
  fire('focusin', textarea)
  assert.equal(textarea.blurred, 1, 'mount focus is dropped')

  // Send-flow refocus: the user tapped the composer first → allowed.
  fire('pointerdown', dom.centerCol)
  fire('focusin', textarea)
  assert.equal(textarea.blurred, 1, 'tap-intended focus is allowed')

  // Send-flow refocus after any other page tap (send button): allowed —
  // this is the regression the guard once broke by blurring mid-send.
  fire('pointerdown', { tagName: 'BUTTON', className: 'send' })
  fire('focusin', textarea)
  assert.equal(textarea.blurred, 1, 'post-send programmatic focus is allowed')

  // Session switch from the drawer: pointerup inside the drawer sets the
  // switch window; the app's programmatic focus is suppressed.
  fire('pointerup', dom.slot)
  fire('focusin', textarea)
  assert.equal(textarea.blurred, 2, 'drawer-switch focus is dropped')

  // Non-textarea focus is never touched.
  const button = { tagName: 'BUTTON', blurred: 0, blur() { this.blurred += 1 } }
  fire('focusin', button)
  assert.equal(button.blurred, 0, 'non-textarea focus passes through')
})

test('discovers the shell structure late (apply before first render)', async () => {
  const dom = makeDom()
  const theme = makeTheme()
  let slotReady = false
  const base = dom.document.querySelector.bind(dom.document)
  dom.document.querySelector = (sel) => (sel === '[data-slot="sidebar"]' && !slotReady ? null : base(sel))

  let toggles = 0
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })
  module.apply(makeCtx(theme, { toggleSidebar() { toggles += 1 } }))

  assert.equal(dom.body.getAttribute('data-dsh-mobile-layout'), 'degraded', 'starts degraded')
  assert.equal(dom.body.children.length, 0, 'no fab before the slot exists')

  // The shell commits after activation: retries must pick the structure up.
  slotReady = true
  await delay(400)
  assert.equal(dom.body.getAttribute('data-dsh-mobile-layout'), 'ok', 'recovered after retry')
  assert.equal(dom.body.children.length, 1, 'fab appears once the structure is found')

  const tap = (target) => {
    for (const l of dom.listeners.filter((l) => l.type === 'pointerup')) l.fn({ target })
  }
  tap(dom.frame)
  assert.equal(toggles, 1, 'drawer dismiss works after late init')
})

test('apply failures are contained (the entry never dies)', () => {
  const dom = makeDom()
  const badRuntime = {
    register() {},
    getTheme() { return { themes: [] } },
    overrideTokens() { throw new Error('boom') }
  }
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })

  assert.doesNotThrow(() => module.apply(makeCtx({ runtime: badRuntime }, { toggleSidebar() {} })))
  // The steps before the failure point still applied: css + version marker.
  assert.ok(dom.styleTags.some((t) => t.dataset.plugin === 'dsh-mobile-theme'), 'css injected before the failure')
  assert.equal(dom.body.getAttribute('data-dsh-mobile-theme'), '0.3.19', 'version marker written')
})

test('inside taps follow the navigation whitelist', async () => {
  const dom = makeDom()
  const theme = makeTheme()
  let toggles = 0
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })
  module.apply(makeCtx(theme, { toggleSidebar() { toggles += 1 } }))

  const tap = (target) => {
    for (const l of dom.listeners.filter((l) => l.type === 'pointerup')) l.fn({ target })
  }

  const sessionRow = { tagName: 'BUTTON', closest: (sel) => (sel.includes('YDXeBa_sessionRow') ? sessionRow : null) }
  const resultRow = { tagName: 'BUTTON', closest: (sel) => (sel.includes('YDXeBa_searchResultRow') ? resultRow : null) }
  const newSession = { tagName: 'BUTTON', closest: (sel) => (sel.includes('hHd-Xa_newSession') ? newSession : null) }
  const gear = { tagName: 'BUTTON', closest: () => null } // settings trigger
  const searchBox = { tagName: 'INPUT', closest: () => null }
  dom.slot.contains = (n) => [dom.slot, sessionRow, resultRow, newSession, gear, searchBox].includes(n)

  // Non-navigation controls keep the drawer open.
  tap(gear)
  tap(searchBox)
  await delay(400)
  assert.equal(toggles, 0, 'settings and search keep the drawer open')

  // Navigation rows close it.
  tap(sessionRow)
  await delay(400)
  assert.equal(toggles, 1, 'session row closes the drawer')

  tap(resultRow)
  await delay(400)
  assert.equal(toggles, 2, 'search result row closes the drawer')

  tap(newSession)
  await delay(400)
  assert.equal(toggles, 3, 'new-session button closes the drawer')
})

test('outside taps are ignored while an official overlay is open', async () => {
  const dom = makeDom()
  const theme = makeTheme()
  let modalOpen = false
  const base = dom.document.querySelector.bind(dom.document)
  dom.document.querySelector = (sel) =>
    sel === '[aria-modal="true"], [role="menu"]' && modalOpen ? { tagName: 'DIV' } : base(sel)

  let toggles = 0
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })
  module.apply(makeCtx(theme, { toggleSidebar() { toggles += 1 } }))

  const tap = (target) => {
    for (const l of dom.listeners.filter((l) => l.type === 'pointerup')) l.fn({ target })
  }

  // Settings sheet / popover open over the drawer: taps anywhere belong
  // to the overlay's own interaction.
  modalOpen = true
  tap(dom.frame)
  tap({ tagName: 'BUTTON', closest: () => null }) // an option inside a portal menu
  await delay(50)
  assert.equal(toggles, 0, 'overlay interactions never dismiss the drawer')

  // Overlay closed: the mask tap dismisses again.
  modalOpen = false
  tap(dom.frame)
  assert.equal(toggles, 1, 'mask tap dismisses once the overlay is gone')

  // The deferred navigation-row close respects an open overlay too.
  const sessionRow = { tagName: 'BUTTON', closest: (sel) => (sel.includes('YDXeBa_sessionRow') ? sessionRow : null) }
  dom.slot.contains = (n) => n === dom.slot || n === sessionRow
  modalOpen = true
  tap(sessionRow)
  await delay(400)
  assert.equal(toggles, 1, 'nav-row close is skipped while an overlay is open')
})

test('floating button label follows the app html[lang]', () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })

  dom.document.documentElement.lang = 'zh-CN'
  module.apply(makeCtx(theme, { toggleSidebar() {} }))
  let fab = dom.body.children.find((c) => c.className === 'dsh-mobile-theme-fab')
  assert.equal(fab.getAttribute('aria-label'), '切换侧栏', 'zh label from html[lang]')

  // A second apply (HMR) re-creates the fab with the same localized label.
  module.apply(makeCtx(theme, { toggleSidebar() {} }))
  fab = dom.body.children.find((c) => c.className === 'dsh-mobile-theme-fab')
  assert.equal(fab.getAttribute('aria-label'), '切换侧栏')
})

test('tap-to-reveal for message time labels (touch hover equivalent)', async () => {
  const dom = makeDom()
  const theme = makeTheme()
  const module = loadModule({ document: dom.document, matchMedia: makeMediaQuery(true) })
  module.apply(makeCtx(theme, { toggleSidebar() {} }))

  const item = {
    tagName: 'DIV',
    className: 'Md3f7G_flowItem',
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
    removeAttribute(k) { delete this.attrs[k] },
    closest(sel) { return sel.includes('Md3f7G_flowItem') ? this : null }
  }
  dom.markedEls.push(item)

  const fireClick = (target) => {
    for (const l of dom.listeners.filter((l) => l.type === 'click')) l.fn({ target })
  }

  fireClick(item)
  assert.equal(item.getAttribute('data-dsh-mobile-times'), '1', 'tap reveals the labels')

  fireClick(item)
  assert.equal(item.getAttribute('data-dsh-mobile-times'), null, 'second tap hides them')

  fireClick(item)
  assert.equal(item.getAttribute('data-dsh-mobile-times'), '1')
  fireClick({ tagName: 'DIV', closest: () => null })
  assert.equal(item.getAttribute('data-dsh-mobile-times'), null, 'tap elsewhere hides all')

  // Action buttons keep their own behavior — no toggle.
  const actionBtn = {
    tagName: 'BUTTON',
    closest(sel) { return sel.includes('p-xYUq_actions') ? this : null }
  }
  fireClick(actionBtn)
  assert.equal(item.getAttribute('data-dsh-mobile-times'), null, 'action-button taps do not reveal')

  // User messages never get the reveal mark — their send time stays always
  // visible, and the mark's max-width rule would clip it.
  fireClick(item)
  assert.equal(item.getAttribute('data-dsh-mobile-times'), '1')
  const userRow = {
    tagName: 'DIV',
    className: 'gdEzaW_userRow',
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null },
    removeAttribute(k) { delete this.attrs[k] },
    closest(sel) { return sel.includes('gdEzaW_userRow') ? this : null }
  }
  fireClick(userRow)
  assert.equal(userRow.getAttribute('data-dsh-mobile-times'), null, 'user rows never get the reveal mark')
  assert.equal(item.getAttribute('data-dsh-mobile-times'), null, 'tapping a user row collapses other revealed items')

  // Auto-hide after 4s.
  fireClick(item)
  assert.equal(item.getAttribute('data-dsh-mobile-times'), '1')
  await delay(4100)
  assert.equal(item.getAttribute('data-dsh-mobile-times'), null, 'auto-hide after 4s')
})
