# 个人主页 · 万天昊

面试用的个人宣传页。围绕三个核心项目构建：**Wide Thought Host**（Rust 开源 AI 编码 Agent）、**AI 面试宝典**（RAG 全栈平台，已上线）、**N-Link**（尼康相机伴侣 App，Kotlin）。

纯手写 HTML / CSS / JavaScript：**零依赖、零构建、零框架**，全部动效为原生实现。

## 特性

- 可交互终端（真的能敲命令：`help` / `projects` / `neofetch` / `sudo hire-me`）
- Canvas 点阵背景（跟随鼠标 + 信号脉冲）
- 三张手绘 SVG 架构动图：Agent 编排、RAG 管道、多通道连接调度
- 流式对话演示（模拟 SSE 逐字输出）、滚动计数、打字机、跑马灯
- 自定义光标、磁吸按钮、卡片聚光灯（仅精确指针设备启用）
- 完整响应式（375px → 1440px）、`prefers-reduced-motion` 降级、打印样式

## 本地预览

任意静态服务器指向本目录即可，例如：

```bash
python -m http.server 8080
# 打开 http://localhost:8080
```

直接双击 `index.html` 也能运行。

## 部署到 GitHub Pages（推荐：用户主站）

用用户名仓库部署后，访问地址最短：`https://wan-1230.github.io`

```bash
# 1. 在 GitHub 新建仓库，命名为 wan-1230.github.io（与用户名一致）
# 2. 推送
git remote add origin https://github.com/Wan-1230/wan-1230.github.io.git
git push -u origin main
# 3. 仓库 Settings → Pages → Source 选 main 分支 / root，稍等 1-2 分钟生效
```

> 想用项目仓库（如 `portfolio`）也可以：推送后 Settings → Pages 开启，地址为 `https://wan-1230.github.io/portfolio/`。
> 部署后记得把简历和 GitHub 个人主页里的链接同步更新。

## 目录结构

```
├── index.html          # 页面结构与全部文案
├── assets/
│   ├── style.css       # 全部样式（设计令牌在 :root）
│   ├── main.js         # 全部交互（终端 / Canvas / 动效编排）
│   └── favicon.svg
├── profile-readme.md   # GitHub 个人主页 README 模板（自行复制到 Wan-1230/Wan-1230 仓库）
└── README.md
```

## 修改内容

- **文案**：全部在 `index.html`，各项目文案集中在对应 `<article>` 内
- **配色**：`assets/style.css` 顶部 `:root` 设计令牌（背景 `--bg`、主色 `--amber`）
- **终端命令**：`assets/main.js` 里的 `CMDS` 对象
- **打字机轮换语**：`main.js` 里的 `rotorLines`
