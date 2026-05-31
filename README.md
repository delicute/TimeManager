# TimeManager ⏱️

**时间管理 + 游戏化激励系统**

通过「赚取余额 → 消耗余额」的经济模型，帮你平衡学习、爱好和娱乐的时间分配。

![GitHub release](https://img.shields.io/github/v/release/delicute/TimeManager)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-35-47848F)

---

## 核心机制

### 余额经济

| 活动 | 效果 | 说明 |
|------|------|------|
| 📚 **学习** | 赚取余额 | 每 `studyWeight` 秒赚 1 余额（默认 2s） |
| 🎨 **爱好** | 赚取余额 | 每 `hobbyWeight` 秒赚 1 余额（默认 4s） |
| 🎮 **娱乐** | 消耗余额 | 每秒消耗 1 余额（负债时 ×2） |

- **赠送余额**：每天自动获得 30 分钟免费额度，优先消耗
- **赚取余额**：学习/爱好积累的余额，赠送用完后自动扣这里
- **负债模式**：余额耗尽后进入负债，消耗速率翻倍

### 里程碑奖励

连续学习或爱好达到特定时长，自动获得一次性赠送余额奖励：

| 节点 | 学习奖励 | 爱好奖励 |
|------|---------|---------|
| 1h | +15min 赠送 | +10min 赠送 |
| 3h | +45min 赠送 | +30min 赠送 |
| 5h | +60min 赠送 | +45min 赠送 |

---

## 功能

- **三种会话模式**：学习 / 爱好 / 娱乐，一键切换
- **余额仪表盘**：实时显示赠送余额、赚取余额、负债状态
- **里程碑进度条**：可视化连续时长进度，到达节点自动领奖
- **智能提醒系统**：基于条件树的复合规则（AND/OR 嵌套）
- **通知容器**：统一的通知管理，按类型区分颜色和图标
- **全局快捷键**：导航/会话控制均支持自定义快捷键
- **系统托盘集成**：最小化到托盘、托盘菜单快速操作
- **多语言**：中文 / English 切换
- **调试面板**：开发模式下可调时间、余额、发通知

---

## 安装

### 下载安装包

从 [Releases](https://github.com/delicute/TimeManager/releases) 下载 `TimeManager Setup X.X.X.exe`，双击安装。

### 从源码构建

```bash
# 克隆
git clone https://github.com/delicute/TimeManager.git
cd TimeManager

# 安装依赖
npm install

# 开发模式运行
npm run dev:electron

# 构建生产版本
npm run build

# 打包为安装包
npm run package
```

安装包生成在 `output/TimeManager Setup X.X.X.exe`。

---

## 快捷键

| 功能 | 默认键 |
|------|--------|
| 导航 - 学习 | `Ctrl+1` |
| 导航 - 爱好 | `Ctrl+2` |
| 导航 - 娱乐 | `Ctrl+3` |
| 导航 - 记录 | `Ctrl+4` |
| 导航 - 提醒 | `Ctrl+5` |
| 导航 - 设置 | `Ctrl+6` |
| 导航 - 调试 | `Ctrl+7` |
| 开始学习 | `Ctrl+Shift+S` |
| 开始爱好 | `Ctrl+Shift+H` |
| 开始娱乐 | `Ctrl+Shift+E` |
| 停止计时 | `Ctrl+Shift+X` |
| 暂停/继续 | `Ctrl+Shift+P` |
| 打印状态 | `Ctrl+Shift+L` |

所有快捷键可在设置页自定义。

---

## 配置

配置文件存储在 `%APPDATA%\TimeManager\data\`：

| 文件 | 说明 |
|------|------|
| `settings.json` | 应用设置（权重、快捷键、语言等） |
| `balance.json` | 余额数据（赚取余额、赠送余额、里程碑进度） |
| `reminders.json` | 提醒规则 |
| `logs/` | 日誌记录 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 19, TypeScript 5.8 |
| 桌面 | Electron 35 |
| 构建 | Vite 6 |
| 图标 | lucide-react |
| 状态管理 | React Context + useReducer |
| 持久化 | 本地 JSON 文件 |
| 打包 | electron-builder + NSIS |

---

## 项目结构

```
TimeManager/
├── electron/              # Electron 主进程
│   ├── main.ts            # 窗口管理、IPC、托盘、通知容器
│   └── preload.ts         # 安全上下文桥接
├── src/                   # React 渲染进程
│   ├── components/        # 可复用组件
│   │   ├── TimerCard.tsx  # 计时器卡片（含里程碑进度条）
│   │   ├── Sidebar.tsx    # 侧边栏导航
│   │   ├── ConfirmDialog  # 确认弹窗
│   │   └── Toast.tsx      # Toast 通知
│   ├── hooks/             # 自定义 Hooks
│   │   ├── useAppStore.tsx    # 全局状态（Context + Reducer）
│   │   ├── useI18n.ts         # 国际化
│   │   └── useToast.ts        # Toast 管理器
│   ├── i18n/              # 多语言文件
│   │   ├── zh.ts          # 中文
│   │   ├── en.ts          # English
│   │   └── types.ts       # 翻译键类型
│   ├── pages/             # 页面组件
│   │   ├── StartPage.tsx       # 主面板（学习/爱好/娱乐切换）
│   │   ├── RecordPage.tsx      # 时间线记录
│   │   ├── SettingsPage.tsx    # 设置
│   │   ├── ReminderPage.tsx    # 提醒规则管理
│   │   ├── DebugPage.tsx       # 调试面板
│   │   └── HotkeySettingsPage.tsx  # 快捷键设置
│   ├── styles/            # 全局样式
│   │   └── global.css     # CSS 变量 + 组件样式
│   ├── utils/             # 工具函数
│   │   └── formatting.ts  # 时间格式化
│   ├── constants.ts       # 共享常量（里程碑定义等）
│   ├── types.ts           # TypeScript 类型定义
│   └── App.tsx            # 应用根组件 + 快捷键分发
├── assets/                # 资源文件
│   └── ico/               # 应用图标
└── scripts/               # 构建脚本
    └── package.js         # electron-builder 打包脚本
```

---

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式（Vite HMR + Electron）
npm run dev:electron

# 构建
npm run build            # 编译渲染层 + 主进程
npm run package          # 构建并打包为 NSIS 安装包
```

---

## 许可

MIT
