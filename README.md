# AI Web Tools

> 一款基于 Electron + React 的桌面端 AI 工具箱，集成 20+ AI 平台入口、嵌入式智能体助手、DeepSeek 数据监控等功能。

![Version](https://img.shields.io/badge/version-3.1.1-blue) ![Platform](https://img.shields.io/badge/platform-Windows-green) ![License](https://img.shields.io/badge/license-MIT-yellow)

## ✨ 核心亮点

- **嵌入式智能体** — 不是独立聊天窗口，而是深度嵌入软件的工作流助手，在任意界面 `Ctrl+Space` 呼出，自动感知当前页面上下文
- **DeepSeek 深度打通** — 询问 Token 用量/费用时，智能体直接调用 API 返回真实数据，并自动跳转数据面板
- **多平台一站式** — 20+ AI 平台统一管理入口，小红书聚光四合一（小红书/聚光平台/创作者中心/专业号）

## 📸 界面预览

| 主页 | 智能体面板 | DeepSeek Monitor |
|:---:|:---:|:---:|
| 多平台入口，一键直达 | Ctrl+Space 随时呼出 | Token 用量实时监控 |

## 🚀 功能特性

### 🤖 嵌入式智能体助手

| 能力 | 说明 |
|------|------|
| 全局快捷键 | `Ctrl+Space` 随时呼出/收起，不依赖焦点 |
| 上下文感知 | 自动识别 WebView 页面、数据面板、文生图等当前界面内容 |
| 深度打通 | 问 DeepSeek 用量 → 调 API 拿真实数据 → 结构化回答 → 自动跳转 Dashboard |
| 联网搜索 | 支持 web_search / web_fetch，实时搜索互联网信息 |
| 文件操作 | 读取/创建/编辑本地文件，列出目录结构 |
| 页面导航 | 智能体可控制软件跳转到指定页面 |
| 多会话 | 支持多个独立会话，历史记录持久化存储 |
| 一键采用 | 智能体生成的提示词可一键填充到输入框 |

### 📊 DeepSeek Monitor 数据面板

- 账户余额实时监控（API Key 验证）
- 本月 Token 用量趋势图（V4 Flash / V4 Pro 分类统计）
- 每日消费明细（近 7 天 / 本月累计）
- 历史月度消费柱状图
- 缓存命中率分析

### 🌐 多平台入口

集成以下 AI 平台，统一管理入口：

- **对话类**：ChatGPT、Gemini、DeepSeek、Kimi、通义千问、智谱清言、MiniMax
- **图像类**：LibLib、RunningHub、TapNow
- **小红书聚光**：小红书、聚光平台、创作者中心、专业号（四合一入口，独立账号管理）
- **其他**：OpenRouter、SiliconFlow、火山引擎等

### 🛠 其他功能

- **文生图 / 图生图** — 集成多种 AI 绘画模型
- **Prompt 管理** — 提示词模板库，支持正向/负向 Prompt
- **生成历史** — AI 图片生成记录管理
- **右键菜单** — 选中文本快速搜索/翻译/发送给智能体
- **深色/浅色主题** — 支持跟随系统或手动切换
- **窗口管理** — 开机自启、最小化到托盘、自定义快捷键
- **常用账号** — 管理各平台账号信息

## 🛠 技术栈

| 技术 | 用途 |
|------|------|
| Electron 33.x | 桌面运行时框架 |
| React 18 + TypeScript | 前端 UI 框架 |
| Vite 6.x | 开发服务器 & 构建 |
| electron-builder | Windows 安装包打包 |
| Lucide React | 图标库 |
| electron-store | 本地持久化存储 |

## 📦 安装

### 下载预编译版本

前往 [Releases](https://github.com/ydd070622/AI-Web-Tools/releases) 下载最新的 Windows 安装包（`.exe`）。

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/ydd070622/AI-Web-Tools.git
cd AI-Web-Tools

# 安装依赖
npm install

# 启动开发环境
npm run dev

# 构建生产版本
npm run build

# 打包 Windows 安装包
npm run build:win
```

安装包输出目录：`release/`

## 📂 项目结构

```
AI_Web_Tools/
├── electron/              # Electron 主进程
│   ├── main.ts            # 主进程入口（窗口管理、快捷键注册）
│   ├── preload.ts         # 预加载脚本（IPC 桥接）
│   ├── ipc/               # IPC 模块
│   │   ├── store.ts       # 本地存储
│   │   ├── search.ts      # 联网搜索
│   │   ├── tools.ts       # 系统工具（快捷键、主题、托盘等）
│   │   ├── auth.ts        # 认证管理
│   │   ├── download.ts    # 下载管理
│   │   └── translate.ts   # 翻译
│   └── tool-handlers.ts   # 智能体工具执行（web_fetch、file_*）
├── src/                   # React 渲染进程
│   ├── components/        # UI 组件
│   │   ├── Sidebar.tsx    # 侧边栏导航
│   │   ├── WebViewPage.tsx # WebView 页面容器
│   │   └── AgentPanel.tsx # 智能体面板
│   ├── pages/             # 页面
│   │   ├── Dashboard.tsx  # DeepSeek 数据面板
│   │   ├── Settings.tsx   # 设置
│   │   ├── TextToImage.tsx # 文生图
│   │   ├── ImageToImage.tsx # 图生图
│   │   ├── XiaoHongShuCards.tsx # 小红书入口
│   │   └── ...
│   ├── services/          # 业务服务
│   │   ├── agent-loop.ts  # 智能体对话循环 & 工具调用
│   │   └── history.ts     # 历史记录管理
│   ├── data/              # 静态数据
│   │   └── platforms.ts   # 平台列表配置
│   ├── App.tsx            # 应用根组件
│   └── main.tsx           # 渲染进程入口
├── public/                # 静态资源
│   ├── favicons/          # 平台图标
│   └── icons/             # 功能图标
└── build/                 # 打包资源（icon、NSIS 脚本）
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Space` | 呼出/收起智能体面板 |
| `F12` | 打开开发者工具 |
| `Ctrl+Shift+I` | 打开开发者工具（备选） |

## 📄 许可证

[MIT](LICENSE)
