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
    var VERSION = __DSH_MOBILE_THEME_VERSION__

    var CSS = __DSH_MOBILE_THEME_CSS__
    var TOKENS = __DSH_MOBILE_THEME_TOKENS__

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
            '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="2.4"/><path d="M10 3.2v1.6M10 15.2v1.6M3.2 10h1.6M15.2 10h1.6M5.3 5.3l1.1 1.1M13.6 13.6l1.1 1.1M5.3 14.7l1.1-1.1M13.6 6.4l1.1-1.1"/></svg>',
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
