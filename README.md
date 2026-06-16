# AI Web Tools

一款基于 Electron + React 的桌面端 AI 工具箱，集成多个 AI 平台入口、智能体助手、DeepSeek 数据监控等功能。

## 功能特性

### 嵌入式智能体助手
- **全局快捷键** `Ctrl+Space` 随时呼出/收起智能体面板
- **深度打通**：在任意界面询问 DeepSeek 用量，智能体直接调用 API 返回真实数据并自动跳转 Dashboard
- **上下文感知**：自动识别当前页面内容（WebView 页面、数据面板等），基于上下文进行针对性回复
- **多工具链路**：支持联网搜索、文件操作、页面导航等多种工具调用
- **多会话管理**：支持多个独立会话，会话持久化存储

### DeepSeek Monitor 数据面板
- 账户余额实时监控
- 本月 Token 用量趋势图（Flash / Pro 分类统计）
- 每日消费明细（近 7 天 / 本月）
- 历史月度消费统计

### 多平台入口
- 集成 ChatGPT、Gemini、DeepSeek、Kimi、LibTV、RunningHub 等 20+ AI 平台
- 小红书聚光（小红书 / 聚光平台 / 创作者中心 / 专业号 四合一入口）
- 文生图 / 图生图 功能

### 其他功能
- 深色/浅色主题切换
- 右键菜单：搜索 / 翻译 / 发送给智能体
- 开机自启、最小化到托盘
- Prompt 管理
- 生成历史记录

## 技术栈

- **Electron** 33.x — 桌面运行时
- **React** 18 + **TypeScript** — 前端框架
- **Vite** 6.x — 构建工具
- **electron-builder** — 打包分发
- **Lucide React** — 图标库

## 开发

```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev

# 构建
npm run build

# 打包 Windows 安装包
npm run build:win
```

## 项目结构

```
├── electron/          # Electron 主进程
│   ├── main.ts        # 主进程入口
│   ├── preload.ts     # 预加载脚本
│   └── ipc/           # IPC 模块（store、search、tools 等）
├── src/               # React 渲染进程
│   ├── components/    # 组件（Sidebar、WebViewPage、AgentPanel）
│   ├── pages/         # 页面（Dashboard、Settings、TextToImage 等）
│   ├── services/      # 服务（agent-loop、history）
│   └── data/          # 静态数据（平台列表等）
├── public/            # 静态资源（图标、favicon）
└── build/             # 打包资源
```

## 许可证

MIT
