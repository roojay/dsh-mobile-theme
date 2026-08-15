# dsh-mobile-theme

中文 | [English](README.md)

将 DeepSeek Harness Web 界面适配到手机与平板的主题插件。它是 `web` profile 的树外插件包，严格建立在官方扩展点之上：

- **主题注册表**（`ctx.theme`）——主题服务的 `overrideTokens` 分层 API（token 级 slot 遮罩的对应物）在手机视口（≤767px 竖屏，或 ≤900×500 横屏）上，把一张 `{ light, dark }` token 表叠加到「当前激活的主题」之上；注册表的 `register` API 额外注册一个可选择的 `dsh-mobile` OLED 深色主题；
- **客户端插件条目**（`dsh.client` / `exports["./client"]`）——web 插件清单在 `/plugins/dsh-mobile-theme/client.js` 提供本包的浏览器 bundle；
- **组合包 patch**（`dsh.bundle.patch`）——一行 `insert` 把本包放进 profile 配置树，这正是 client-modules 节点侧扫描并服务它的前提。

没有 React 代码、没有宿主服务、没有 settings schema：布局工作是一份注入的样式表加客户端 bundle 里约 300 行 DOM 行为。节点侧是有意的空 `apply`——web 插件扫描要求宿主条目拥有 fiber。

## 手机（≤767px 竖屏，≤900×500 横屏）上的改动

| 界面 | 桌面行为 | 移动端行为 |
|---|---|---|
| 侧边栏 | 网格列，264–420px | 完全隐藏；左上角 ☰ 悬浮按钮（body 级 DOM）唤出**浮层抽屉**（`min(320px, 88vw)`），压在蒙层之上；点会话/搜索结果/新建会话等**导航行**自动收起；搜索、设置、工具等其余交互保持打开；**有官方浮层（设置面板/目录选择器/popover 菜单，即 `aria-modal="true"` 或 `role="menu"`）打开时，浮层内的任何交互都不会动抽屉**；遮罩/收起按钮/Esc 收起 |
| 对话区 | 中央列 | **真全宽**——网格重写为单一 `minmax(0, 1fr)` 轨道，不再预留窄轨 |
| 头部 | 固定标题行 | **重排**：左侧为 ☰ 预留槽位、标题簇紧凑化、工具区可横向滚动 |
| 详情面板 | 第三网格列，300–520px | 右侧浮层抽屉；对话区始终保持全宽 |
| 列拖拽手柄 | 可见 | 隐藏（触屏不做 col-resize） |
| 输入条 | 34px 发送键、16px 边距 | 40px 触控目标、更紧凑的边距、底部工具栏单行（左侧工具组弹性收缩、选择器可截断，不做滚动容器以免裁剪权限 popover；发送键固定不动）、`env(safe-area-inset-bottom)` 内边距避开 Home 条 |
| 头部/标签页 | 固定 36px 间距 | 紧凑内边距、可横向滚动的标签行 |
| 消息操作 | 28px | 32px 触控目标；时间/统计标签在触屏以**紧凑截断形式常显**（上限 30% 宽 + 省略号，单行不溢出） |
| 设置 | 居中 800px 弹窗 + 侧边导航 | 全屏 sheet（`100dvh`）+ 横向滚动分区导航 |
| `/` `@` 触发菜单 | 锚定输入条 | 视口约束、44px 行高、`55dvh` 最大高度悬浮于键盘之上 |
| 工具调用「查看」按钮 | hover 才显示（`opacity: 0`） | `hover: none` 设备上常显 |
| 代码复制按钮 | 文字尺寸 | 隐形 `::after` 扩热区（约 30×30px 点击区域），图标位置不动 |
| 滚动 | 默认 | 惯性滚动 + `overscroll-behavior`（无橡皮筋链式回弹） |
| 横屏手机 | 桌面布局 | 完整手机体验（抽屉 + ☰）+ 紧凑纵向节奏 |
| 目录选择器 | 居中 680px 弹窗 | 全屏 sheet、40px 行高、底部操作同排 |
| Cordis 面板 | `bottom: 128px` 弹层 | 视口宽 sheet，抬高避开输入条 |
| 目标栏 / 权限 / 任务 | 28px 控件 | 36–44px 控件；任务菜单变头部下方固定 sheet |
| Android 返回手势 | — | 返回键关闭抽屉（带标记的历史条目，不干扰应用自身） |
| 软键盘 | — | `visualViewport` 兜底：布局视口不收缩的浏览器上输入条自动抬到键盘上方（以 padding 收缩对话列根部、仅在输入框聚焦时生效、blur 立即回收，滚动容器内容不动，回到底部按钮不脱位）；**切换会话不弹键盘**（意图守卫拦截程序性聚焦） |
| 长按复制 | — | 消息/代码文本保持可选中，控件屏蔽 iOS 链接呼出菜单 |
| 无障碍 | — | ☰ 按钮经 frame MutationObserver 同步 `aria-expanded`，`aria-label` 跟随应用 `html[lang]` |

运行时还会升级 viewport meta：追加 `viewport-fit=cover`（刘海屏获得真实 safe-area `env()` 值）与 `interactive-widget=resizes-content`（Android Chrome 让输入条保持在软键盘上方）。

竖屏平板（768–1023px，官方 1024px 侧栏自动收起断点之下）获得一条适度的收紧带：更小的侧边净空、稍大的发送键。横屏手机（≤900×500）则并入手机布局，额外获得紧凑纵向节奏。

## 主题层

在手机视口（≤767px 竖屏，或 ≤900×500 横屏）上，插件把 `overrideTokens('dsh-mobile-theme', …)` 叠加到**当前激活的主题**之上——用户持久化的 `light` / `dark` / `system` 偏好始终不被触碰。每个 token 都是 `{ light, dark }` 值对（运行时强制要求双模式），因此系统配色切换后调色板依旧可读：

- 浅色：更柔和的 `rgb(250,250,250)` 基底、在强光下更清晰的分隔线与交互填充；
- 深色：OLED 阶梯（基底 `rgb(15,15,15)` → 分层 `21,21,23` / `27,27,28` → 浮层 `44,44,46`），并提高 hover/active 对比度。

同一套深色调色板也注册为可选择的 `dsh-mobile` 主题（`colorScheme: dark`）。第三方主题 id 按设计只是进程内扩展——它们不进入内置 settings schema——因此自动主题层是主机制；`dsh-mobile` 面向程序化选择与注册表检视。

## 安装

```sh
# 从 npm 安装（发布后）：
dsh plugin --profile web add dsh-mobile-theme

# 在本包 checkout 目录中：
dsh plugin --profile web add "dsh-mobile-theme@file:$PWD"

# 插件管理器会自动合并 profile manifest，验证：
cat "$DSH_HOME/profiles/web/package.json"   # bundles: [..., "dsh-mobile-theme"]

# 重启 Web profile，让运行中的服务器重新组合配置树：
dsh web
```

卸载：`dsh plugin --profile web remove dsh-mobile-theme`，随后重启。依赖移除后，reconcile 会同步移除 `dsh.profile.bundles` 中的对应行。

插件是纯客户端 bundle 加一个空节点侧，因此模型看到的内容不受任何影响，也不会触碰会话或设置。


`REGRESSION.md` 是发布前/升级后的真机回归清单，覆盖全部特性。

## 开发

```sh
npm run build      # 把 src/client.css + src/tokens.json + 包版本 嵌入 lib/client.js
npm test           # build + node:test 套件（bundle 形态、fake 环境下的 apply 行为）
npm run deploy:hot # build + 复制 lib/client.js 到运行中的 profile——无需重启
```

`src/client.css` 是作者样式表；`src/client.template.js` 是 module-loader bundle 模板；`scripts/build-client.mjs` 替换三个占位符。harness 原样服务 `lib/client.js`。**热更新**：client-hmr 的 node 侧会 stat-poll 每个图 bundle，`deploy:hot`（就是把新产物复制进 `$DSH_HOME/profiles/web/node_modules/dsh-mobile-theme/lib/client.js`）会触发 SSE `rebuilt` 帧——已连接的浏览器原地替换插件 fiber，无需刷新、无需重启服务。`dsh plugin --profile web update` 则会按源码重装包，手工复制是日常快循环。

## 模型体验

无。插件从不组装提供方请求、从不写入提示词、不触碰会话与设置；浏览器侧主题层只关乎呈现。

#### KV Cache 影响

无；不产生任何模型可见输出。

## 架构：升级韧性

官方文档化的扩展点是：主题 token 系统（`--dsw-*`、`ctx.theme`）、slot 系统（槽名 + `data-slot` 包装层 + `ctx.slots`）、`ctx.layout` 面板服务与 `data-*` 状态属性。**CSS module 哈希类名只是构建产物，从未成为契约**——布局全靠钉死哈希，正是「官方一升级插件就挂」的失败模式。因此本包的 CSS 分为三层：

| 层 | 职责 | 依赖 | 上游变更时的表现 |
|---|---|---|---|
| 1 · 官方 API | 主题层、注册主题、viewport meta、抽屉开关 | token 注册表、`ctx.layout` | 不受影响（文档化 API） |
| 2 · 结构自标记 | 全宽网格、浮层抽屉、蒙层、☰ 按钮、键盘抬升 | `data-slot` 结构 + DOM 列顺序，运行时自校验 | **优雅降级**：发现失败 → 不打标记 → 布局规则全部失效 → 回到官方窄轨布局、功能完好；`body[data-dsh-mobile-layout="degraded"]` + 一行控制台提示 |
| 3 · 美容微调 | 触控尺寸、设置全屏 sheet、目录选择器/Cordis/任务微调 | 钉死的 0.1.0-rc.6 哈希类名（集中一处） | 仅损失美观，应用保持可用 |

第 2 层是核心机制：apply 时 bundle 从文档化的 `[data-slot="sidebar"]` 包装层出发（槽包装层 → 侧栏列 → 网格 frame），用应用的内联 `gridTemplateColumns` 自校验 frame（校验 1）、用 `data-shell-overlay` 哨兵自校验第三列（校验 2），随后给各列打上插件自有的 `data-dsh-mobile-*` 属性。样式表中所有布局关键规则都只认这些属性——绝不认哈希。childList MutationObserver 在列重挂载时重新打标。因此上游重新哈希类名**不可能**破坏布局；只有当文档化的 slot 结构变更时才会触发，而此时插件是降级而非半残。

## 已知限制与暂缓事项

- **第 3 层美容哈希随版本固定**：微调规则针对 `@deepseek-ai/dsh-*` 0.1.0-rc.6 的类名哈希（如 `VOzbGW_panel`、`uV2eYG_primary`）。上游重新哈希只会丢失这些微调（纯美容）；`npm test` 的选择器契约使该钉扎显式化，并在本仓库 CSS 意外漂移时让构建失败。
- **抽屉依赖 CSS 与 JS 协同**：手机上窄轨完全隐藏，抽屉入口是注入的 ☰ 悬浮按钮；蒙层/Escape 关闭与按钮都经 `ctx.layout`。没有 layout 服务时 CSS 层仍生效，但不会注入 ☰ 按钮（手机上抽屉保持隐藏）。
- **注册主题 id 仅进程内生效**：`dsh-mobile` 不跨刷新持久化（内置 settings schema 只接受 `light`/`dark`/`system`），Appearance 行也不列出第三方主题——这正是第三方主题「表层」定位的文档化行为。
- **历史关闭边界**：若应用在打开的抽屉之上又压入自己的历史条目，UI 关闭会消费最顶条目，抽屉的标记条目留待多按一次返回键（标记保证返回处理器不会误触外部条目）。
