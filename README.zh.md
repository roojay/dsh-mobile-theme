# dsh-mobile-theme

中文 | [English](README.md)

DeepSeek Harness Web 的移动端适配插件。**0.5.0 对齐 DSH 0.1.5-rc.2**，运行时无新增依赖，通过官方主题服务和布局服务加载一个浏览器 bundle；Node 入口只负责让插件被发现。

## 兼容版本

| 项目 | 本次核查基线 |
|---|---|
| 最新发布版 | `dsh-v0.1.5-rc.2`，`fb2c4b9e698e30edb738bca4cf0618587db7d203` |
| 上游 master | `c291e7961a515f6d7af9304e7fd1d257929aef26`，2026-09-10 |
| 主题、布局 peer 依赖 | 精确锁定 `0.1.5-rc.2` |
| 旧版 DSH | 使用匹配的旧版插件；0.5.0 不承诺向后兼容 |

DSH 0.1.5 用支持标签页和文件预览的右侧 Sidebar 替换了 Details，主内容 Slot 改为 `main`，输入框改为 Lexical `contenteditable`。本次同时适配这三项变化，源码依据和验证方式见 [COMPATIBILITY.md](COMPATIBILITY.md)。

## 移动端特性

手机模式覆盖宽度 ≤767px，以及宽度 ≤900px 且高度 ≤500px 的横屏手机。768–1023px 的竖屏平板仅收紧间距，桌面保留官方布局。

| 区域 | 手机端行为 |
|---|---|
| 主布局 | 对话全宽，左侧图标窄轨不再占空间 |
| 左侧菜单 | ☰ 打开 320px / 88vw 浮层；蒙层和 Escape 关闭；点击会话、搜索结果、新会话及全局面板导航后收起 |
| 右侧预览 | 手机和横屏手机均铺满视口，保留官方标签、分栏状态和关闭控件 |
| Android 返回 | 通过所属服务关闭抽屉；左菜单切换到右预览时复用同一个历史条目 |
| 输入框 | 放大发送、添加按钮；模型选择器可收缩，工具栏维持单行；权限菜单不被滚动容器裁切 |
| 软键盘 | 视口缩放设置、安全区与 `visualViewport` 避让兼容 Lexical；抑制初始加载和切换会话时的自动唤起，保留主动点击聚焦 |
| 消息 | 正文可选择复制；放大操作按钮和代码复制热区；点击显示助手消息时间，4 秒后隐藏，用户消息时间常显 |
| 设置 | 与菜单等宽的设置面板，分类横向滚动，内容独立纵向滚动 |
| 弹层 | 目录选择器增高、操作区加大；命令/提及菜单、任务和 Cordis 弹层限制在视口内 |
| 新版反馈 | 限制反馈对话框尺寸，放大操作热区 |
| 主题 | 在当前主题之上叠加手机专用浅色/深色 token，同时注册 `dsh-mobile` OLED 深色主题 |

不改写用户的浅色/深色/跟随系统偏好，不添加模型指令、不修改模型请求、不影响 KV Cache；侧栏操作交给 DSH 原生服务，由其按原有逻辑记录 UI 状态。

## 安装

先使用匹配的 DSH `0.1.5-rc.2`（本次核查时位于 npm 的 `next` 标签）。在插件仓库目录执行：

```sh
npm run build
dsh plugin --profile web add "dsh-mobile-theme@file:$PWD"
dsh web
```

插件 0.5.0 发布到 npm 后，可改用 `dsh plugin --profile web add dsh-mobile-theme@0.5.0`。安装后重启 Web profile。控制台检查 `document.body.dataset.dshMobileTheme` 应为 `0.5.0`，`document.body.dataset.dshMobileLayout` 应为 `ok`。

卸载：`dsh plugin --profile web remove dsh-mobile-theme`，然后重启。

## 开发与验证

```sh
npm run build
npm test
npm run deploy:hot

# 指向已安装的官方 DSH 0.1.5-rc.2 包：
DSH_NODE_MODULES=/path/to/dsh/node_modules npm run check:upstream
```

`src/client.css` 使用 `.dsh-Module_local` 别名，`src/selectors.json` 指定所属包和样式文件。浏览器从官方 `data-plugin-css` 样式标签解析当前类名，跟踪延迟加载和 HMR，并将适配样式放在官方样式之后。局部类名消失时仅停用对应规则，不再写死旧的 CSS 哈希。

关键布局依赖经过校验的 `sidebar`、`main`、`rightbar` 列和插件自有属性，接受浏览器规范化后的 `minmax(0px, 1fr)`。结构不匹配时清理旧标记、隐藏悬浮菜单按钮，保留官方布局，并设置 `degraded` 诊断。卸载 fiber 时回收样式、标记、监听器、定时器和主题注册。

`deploy:hot` 将构建结果复制到 `$DSH_HOME/profiles/web/node_modules/dsh-mobile-theme/lib/client.js`，由 DSH 的 HMR 触发更新；不会发布插件或升级 DSH。

## 已知限制

- 上游的样式文件名、局部类名、Slot 结构和服务方法尚未稳定；每次升级都应执行 `check:upstream` 和 [REGRESSION.md](REGRESSION.md)。
- 静态打包的 Markdown 代码复制按钮没有插件样式标签，使用限制在消息区域内的局部名称模式匹配。
- 抽屉上方若出现应用自己的历史条目，UI 关闭抽屉不会消费它；较早的抽屉标记可能留待后续返回操作处理。
- 自动化浏览器不能代替真机软键盘、输入法、iOS 安全区和 Android 系统返回手势验收。
