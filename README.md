# TimeManager

manage your time.

A desktop time management application that helps you balance study, hobbies, and entertainment through an incentive-based system. Built with Electron, React, and TypeScript.

## Features

- **Three session modes**: Study, Hobby, and Entertainment
- **Balance system**: Earn time for focused activities, spend it on entertainment
- **Milestone rewards**: Reach continuous study/hobby goals to earn bonus balance
- **Intelligent reminders**: Condition-based rules with complex AND/OR logic trees
- **Notification container**: Unified notification system with type-specific icons and colors
- **Desktop integration**: System tray, global hotkeys, auto-start, minimize to tray
- **Internationalization**: Chinese and English UI
- **Customizable**: Adjustable earning rates, notification settings, hotkey bindings

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.8 |
| Desktop | Electron 35 |
| Build | Vite 6 |
| Icons | lucide-react |
| State | React Context + useReducer |
| Persistence | Local JSON files |

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev:electron

# Build for production
npm run build:electron
```

## How It Works

The core mechanic is a **balance economy**:

- **Study** and **Hobby** sessions earn entertainment balance over time
- **Entertainment** sessions consume balance
- Each day starts with 30 minutes of free balance
- Going into debt doubles the consumption rate and halts earning
- Continuous study/hobby time unlocks milestone rewards at 1h, 3h, and 5h

## Project Structure

```
TimeManager/
├── electron/          # Electron main process
│   ├── main.ts        # Window management, IPC, notification container
│   └── preload.ts     # Context bridge APIs
├── src/               # React renderer
│   ├── components/    # Reusable UI components
│   ├── hooks/         # App state, i18n
│   ├── i18n/          # Chinese/English translations
│   ├── pages/         # Study, Hobby, Entertainment, Record, Settings, Reminder
│   ├── styles/        # CSS variables and global styles
│   └── utils/         # Formatting helpers
└── assets/            # Application icons and audio
```
