/**
 * Browser half of dsh-mobile-theme (module-loader bundle template).
 *
 * Built by scripts/build-client.mjs, which substitutes the four
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
 *   6. Drawer behavior: one body-level menu button uses ctx.layout;
 *      right-preview close uses its owner, ctx.sidebarRight. Settings
 *      remains the native trigger in the sidebar footer.
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
    var VERSION = __DSH_MOBILE_THEME_VERSION__

    var CSS = __DSH_MOBILE_THEME_CSS__
    var STYLE_MODULES = __DSH_MOBILE_THEME_SELECTORS__
    var TOKENS = __DSH_MOBILE_THEME_TOKENS__

    /** Version marker: lets a user confirm which bundle is actually live
     *  via `document.body` (no console noise in production). */
    function markVersion() {
      if (typeof document === 'undefined' || document.body === null) return
      document.body.setAttribute('data-dsh-mobile-theme', VERSION)
    }

    // Resolve cosmetic aliases from the owning package's live stylesheet.
    // A missing/renamed local becomes an inert class, never a broad suffix match.
    var selectors = Object.create(null)
    function resolveSelectors(text) {
      return text.replace(/\.dsh-([A-Za-z0-9]+)_([A-Za-z0-9_]+)/g, function (alias) {
        return selectors[alias] || '.dsh-mobile-unavailable'
      })
    }

    function injectCss(ctx) {
      if (typeof document === 'undefined') return
      ctx.effect(function () {
        var tag = document.querySelector('style[data-plugin-css="' + CSS_TAG_ID + '"]')
        if (tag === null) {
          tag = document.createElement('style')
          tag.dataset.plugin = PACKAGE
          tag.dataset.pluginCss = CSS_TAG_ID
          document.head.appendChild(tag)
        }
        function refresh() {
          selectors = Object.create(null)
          for (var alias in STYLE_MODULES) {
            var sheet = document.querySelector('style[data-plugin-css="' + STYLE_MODULES[alias] + '"]')
            if (sheet === null) continue
            var pattern = /\.([_a-zA-Z][\w-]*_([a-zA-Z][\w]*))(?![\w-])/g
            var match
            while ((match = pattern.exec(sheet.textContent)) !== null) {
              selectors['.dsh-' + alias + '_' + match[2]] = '.' + match[1]
            }
          }
          var css = resolveSelectors(CSS)
          if (tag.textContent !== css) tag.textContent = css
          // Hosts can load cosmetic packages after this plugin. Equal-specificity
          // overrides must remain after their live styles, including after HMR.
          if (document.head.lastElementChild && document.head.lastElementChild !== tag) document.head.appendChild(tag)
        }
        refresh()
        var observer = typeof MutationObserver === 'function' ? new MutationObserver(refresh) : null
        if (observer !== null) observer.observe(document.head, { childList: true, subtree: true, characterData: true })
        return function () {
          if (observer !== null) observer.disconnect()
          if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
          selectors = Object.create(null)
        }
      }, PACKAGE + ': live stylesheet aliases')
    }

    function editable(el) {
      if (el === null || typeof el.tagName !== 'string') return false
      var tag = el.tagName.toUpperCase()
      return tag === 'TEXTAREA' || tag === 'INPUT' || el.isContentEditable === true
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
      return theme.register({ id: MOBILE_THEME_ID, colorScheme: 'dark', tokens: mobileThemeTokens() })
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
      injectCss(ctx)
      upgradeViewportMeta()
      markVersion()
      ctx.effect(function () { return registerTheme(ctx.theme) }, PACKAGE + ': registered theme')

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
      {
        ctx.effect(function () {
          function onChange() {
            syncLayer()
          }
          if (mq !== null && typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange)
          else if (mq !== null && typeof mq.addListener === 'function') mq.addListener(onChange)
          return function () {
            if (mq !== null && typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onChange)
            else if (mq !== null && typeof mq.removeListener === 'function') mq.removeListener(onChange)
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
            return editable(el)
          }
          function applyInset(value) {
            var scroller = document.querySelector('[data-conversation-scroll]')
            var stick = scroller !== null && scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80
            if (value === null) rootEl.style.removeProperty('--dsh-mobile-keyboard-inset')
            else rootEl.style.setProperty('--dsh-mobile-keyboard-inset', value + 'px')
            // Decide from the old viewport height; changing padding can shrink it.
            if (stick && value !== lastApplied && (value === null || lastApplied === null)) scroller.scrollTop = scroller.scrollHeight
            lastApplied = value
          }
          function syncKeyboard() {
            if (mq !== null && !mq.matches) {
              applyInset(null)
              return
            }
            if (!keyboardContextActive() || (vv.scale && Math.abs(vv.scale - 1) > 0.01)) {
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
      var markedStructure = null
      var markNames = { frame: 'frame', sidebarCol: 'sidebar-col', centerCol: 'center-col', rightbarCol: 'rightbar-col' }
      function clearStructure() {
        if (markedStructure === null) return
        for (var key in markNames) markedStructure[key].removeAttribute('data-dsh-mobile-' + markNames[key])
        markedStructure = null
      }
      function discoverStructure() {
        var slot = document.querySelector('[data-slot="sidebar"]')
        if (slot === null || slot.parentElement === null) return null
        var sidebarCol = slot.parentElement
        var frame = sidebarCol.parentElement
        if (frame === null || !frame.style || typeof frame.style.gridTemplateColumns !== 'string' || !/minmax\(\s*0(?:px)?\s*,\s*1fr\s*\)/.test(frame.style.gridTemplateColumns)) return null
        var centerCol = sidebarCol.nextElementSibling
        var rightbarCol = centerCol === null ? null : centerCol.nextElementSibling
        if (rightbarCol === null || !rightbarCol.querySelector('[data-slot="rightbar"]') || !centerCol.querySelector('[data-slot="main"]')) return null
        return { frame: frame, sidebarCol: sidebarCol, centerCol: centerCol, rightbarCol: rightbarCol, slot: slot }
      }
      function markStructure() {
        if (typeof document === 'undefined') return null
        var next = discoverStructure()
        if (next === null || markedStructure === null || next.frame !== markedStructure.frame || next.sidebarCol !== markedStructure.sidebarCol || next.centerCol !== markedStructure.centerCol || next.rightbarCol !== markedStructure.rightbarCol) {
          clearStructure()
          markedStructure = next
          if (next !== null) for (var key in markNames) next[key].setAttribute('data-dsh-mobile-' + markNames[key], '')
        }
        if (document.body) document.body.setAttribute('data-dsh-mobile-layout', next === null ? 'degraded' : 'ok')
        return next
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
            clearStructure()
            if (document.body) {
              document.body.removeAttribute('data-dsh-mobile-layout')
              document.body.removeAttribute('data-dsh-mobile-theme')
            }
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
            if (t === null || !editable(t)) return
            var col = document.querySelector('[data-dsh-mobile-center-col]')
            if (col === null || typeof col.contains !== 'function' || !col.contains(t)) return
            if (typeof t.matches === 'function' && !t.matches('[data-composer-input], textarea')) return
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
            if (t.closest('button, a, input, textarea, [contenteditable], [role="button"]') !== null) return
            // Action buttons keep their own behavior.
            if (t.closest(resolveSelectors('.dsh-MessageIconActions_actions')) !== null) return
            // User messages have nothing to reveal (their send time is
            // always visible): never mark them — just collapse any other
            // revealed row, so the mark can never clip the user time.
            if (t.closest(resolveSelectors('.dsh-MessageItem_userRow')) !== null) {
              hideAll()
              clearTimer()
              return
            }
            var item = t.closest('[data-chat-flow-key]')
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

      // Drawer behavior + ☰ / settings floating buttons. Buttons are
      // injected as soon as `layout` is available — they must not wait
      // on shell-column discovery, or hiding the official 56px rail
      // leaves the phone with no entry point. CSS shows them only on
      // phones; the header reserves their slots.
      var layout = null
      try {
        layout = ctx.get('layout')
      } catch (err) {
        layout = null
      }
      if (layout !== null && typeof layout.toggleSidebar === 'function' && typeof document !== 'undefined') {
        var drawerFab = null

        ctx.effect(function () {
          var fabCleanup = injectFabs(layout)
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
            fabCleanup()
          }
        }, PACKAGE + ': drawer + fab behavior')

        function injectFabs(layoutHandle) {
          var fab = null
          var languageObserver = null
          function appIsZh() {
            var docLang = typeof document.documentElement === 'object' && document.documentElement !== null
              ? (document.documentElement.lang || document.documentElement.getAttribute('lang') || '')
              : ''
            return docLang.toLowerCase().indexOf('zh') === 0
          }
          if (typeof document.body !== 'undefined' && document.body !== null) {
            fab = document.createElement('button')
            fab.type = 'button'
            fab.className = 'dsh-mobile-theme-fab'
            fab.setAttribute('aria-label', appIsZh() ? '切换侧栏' : 'Toggle sidebar')
            fab.setAttribute('aria-expanded', 'false')
            fab.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 5.5h14M3 10h14M3 14.5h14"/></svg>'
            fab.addEventListener('click', function () { layoutHandle.toggleSidebar() })
            document.body.appendChild(fab)
          }
          if (fab !== null && typeof MutationObserver === 'function') {
            languageObserver = new MutationObserver(function () {
              fab.setAttribute('aria-label', appIsZh() ? '切换侧栏' : 'Toggle sidebar')
            })
            languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
          }
          drawerFab = fab
          return function () {
            if (languageObserver !== null) languageObserver.disconnect()
            if (fab !== null && fab.parentNode !== null) fab.parentNode.removeChild(fab)
            drawerFab = null
          }
        }

        function initDrawer(marks) {
          var frame = marks.frame
          var slot = marks.slot
          var sidebarCol = marks.sidebarCol

          function isFabTarget(t) {
            if (t == null) return false
            var node = t
            while (node) {
              var cls = node.className || ''
              if (cls === 'dsh-mobile-theme-fab') return true
              node = node.parentNode || node.parentElement || null
            }
            return false
          }

          var historyApi = win !== null && win.history &&
            typeof win.history.pushState === 'function' && typeof win.history.back === 'function'
          var existingMarker = historyApi && win.history.state ? win.history.state.dshMobileTheme : null
          var pushed = existingMarker === 'sidebar' || existingMarker === 'rightbar' ? existingMarker : null

          function expanded() {
            return frame !== null && !frame.hasAttribute('data-sidebar-collapsed')
          }

          function rightbarOpen() {
            return document.querySelector('[data-sidebar-right-panel][data-sidebar-right-open]') !== null
          }

          function closeRightbar() {
            if (!rightbarOpen()) return
            // closeRightbar on layout only reports geometry; the owner records
            // expansion and must perform the actual close.
            var service = ctx.get('sidebarRight')
            if (service && service.isExpanded() && typeof service.toggleExpanded === 'function') service.toggleExpanded()
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
          var closeTimer = null

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
                ? t.closest(resolveSelectors('.dsh-Rows_sessionRow, .dsh-Rows_searchResultRow, .dsh-SidebarRoot_newSession, .dsh-SidebarRoot_panelRow'))
                : null
              if (navRow === null) return
              if (closeTimer !== null) clearTimeout(closeTimer)
              closeTimer = setTimeout(function () {
                closeTimer = null
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
            if (e.key !== 'Escape' || overlayOpen()) return
            if (expanded()) closeDrawer()
            else if (drawerMode()) closeRightbar()
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
              // rightbar's entry, close the right preview.
              if (pushed === 'rightbar' && rightbarOpen()) closeRightbar()
              pushed = 'sidebar'
              return
            }
            if (marker === 'rightbar') { pushed = 'rightbar'; return }
            // Navigated past our drawer entry: close what we pushed.
            var which = pushed
            pushed = null
            if (which === 'sidebar') {
              if (!drawerMode()) return
              if (expanded()) layout.toggleSidebar()
            } else if (which === 'rightbar') {
              if (rightbarOpen()) closeRightbar()
            }
          }

          // Open/close transitions: aria mirror + history bookkeeping.
          var observer = null
          if (frame !== null && typeof MutationObserver === 'function') {
            observer = new MutationObserver(function () {
              var sidebarOpen = expanded()
              var rightbarOpenNow = rightbarOpen()
              if (drawerFab !== null) drawerFab.setAttribute('aria-expanded', sidebarOpen ? 'true' : 'false')
              if (!historyApi) return

              var current = drawerMode() ? (sidebarOpen ? 'sidebar' : rightbarOpenNow ? 'rightbar' : null) : null
              var owned = pushed !== null && win.history.state && win.history.state.dshMobileTheme === pushed
              if (current !== null && pushed === null) {
                win.history.pushState(Object.assign({}, win.history.state, { dshMobileTheme: current }), '')
                pushed = current
              } else if (current !== null && current !== pushed && owned) {
                win.history.replaceState(Object.assign({}, win.history.state, { dshMobileTheme: current }), '')
                pushed = current
              } else if (current === null && pushed !== null) {
                pushed = null
                if (owned) win.history.back()
              }
            })
            observer.observe(frame, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-sidebar-collapsed', 'data-sidebar-right-open'] })
          }

          document.addEventListener('pointerup', onPointerUp, true)
          document.addEventListener('click', onClick, true)
          document.addEventListener('keydown', onKey, true)
          if (win !== null && historyApi) win.addEventListener('popstate', onPopState)

          // Follow replaced shell roots and retract stale layout marks.
          var remarker = null
          if (frame !== null && typeof MutationObserver === 'function') {
            remarker = new MutationObserver(function () {
              var again = markStructure()
              var oldFrame = frame
              frame = again === null ? null : again.frame
              slot = again === null ? null : again.slot
              sidebarCol = again === null ? null : again.sidebarCol
              if (observer !== null && oldFrame !== frame) {
                observer.disconnect()
                if (frame !== null) observer.observe(frame, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-sidebar-collapsed', 'data-sidebar-right-open'] })
              }
            })
            remarker.observe(document.body, { childList: true, subtree: true })
          }

          return function () {
            if (closeTimer !== null) clearTimeout(closeTimer)
            document.removeEventListener('pointerup', onPointerUp, true)
            document.removeEventListener('click', onClick, true)
            document.removeEventListener('keydown', onKey, true)
            if (win !== null && historyApi) win.removeEventListener('popstate', onPopState)
            if (observer !== null && typeof observer.disconnect === 'function') observer.disconnect()
            if (remarker !== null && typeof remarker.disconnect === 'function') remarker.disconnect()
          }
        }
      }
    }

    exports.apply = apply
    exports.inject = ['theme', 'layout']
    return module.exports
  }
})
