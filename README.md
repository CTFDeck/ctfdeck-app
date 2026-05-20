# CTFDeck App

CTFDeck App is the desktop/web frontend for CTFDeck, a workspace for Capture The Flag and security assessment workflows. It connects to the CTFDeck backend over WebSocket and provides a terminal, target management, command runner jobs, write-ups, projects, and tool installation views in one interface.

This repository contains the Angular/Electron frontend. The backend lives in [`ctfdeck-back`](https://github.com/CTFDeck/ctfdeck-back).

---

## Status

**Current stage: feature-complete milestone build**

The initial PoC milestones are complete. The frontend is no longer a static mock: it works with the backend for command execution, persisted sessions, targets, write-ups, projects, tool inventory, and import/export workflows.

---

## Features

### Terminal

- WebSocket connection to the backend terminal server.
- Real-time streaming output with ANSI color rendering.
- Current working directory prompt and `cd` tracking.
- Command history with `Up`/`Down`.
- File and directory autocompletion with `Tab`.
- Interactive stdin for running commands, including `sudo` prompts and confirmation prompts.
- Ctrl+C interrupt and Ctrl+D EOF signals for active jobs.
- Selection actions to copy terminal text or add it directly to a write-up.

### Sessions and Workspace

- Create, rename, open, and delete terminal sessions.
- Persist command history and command output through the backend.
- Sidebar with recent sessions and write-ups.
- Auto naming from the first command.

### Targets

- Add, edit, and delete targets.
- Store target name, address, port, and type.
- Use targets in command templates.

### Command Runner and Jobs

- Run predefined tools and custom scripts against selected targets.
- Save per-target command overrides.
- Background job execution with a Jobs panel.
- Stop, restart, remove, and clear completed jobs.
- Streaming job output with terminal-style formatting.
- Help view for selected tools.

### Tools

- Tool catalog and inventory from the backend.
- Missing tool detection.
- Install and uninstall flows with progress updates.
- Sudo password modal for privileged installs/uninstalls.

### Write-ups

- Create, rename, edit, and delete Markdown write-ups.
- Markdown editor with live preview.
- Attach selected terminal output to existing or quick-created write-ups.
- Project-aware write-up organization.

### Projects

- Create and manage projects.
- Organize sessions and write-ups under projects and folders.
- Import/export projects through the backend.
- Export options for sessions, history, targets, write-ups, media, and scripts.

### UI

- Light/dark theme with saved preference.
- Language switcher.
- Electron desktop packaging.
- Shared UI components under `libs/ui`.

---

## Tech Stack

- Angular
- TypeScript
- Electron
- Tailwind CSS
- SpartanNG local UI components
- WebSocket binary protocol shared with the backend

---

## Requirements

- Node.js and npm for frontend development.
- CTFDeck backend running locally or remotely.
- Default backend WebSocket URL: `ws://localhost:42712`.

For backend setup, see the [CTFDeck backend user guide](https://github.com/CTFDeck/ctfdeck-back/blob/main/docs/USER.md).

---

## Development

Install dependencies:

```bash
npm install
```

Run the web app:

```bash
npm start
```

Run the Electron app:

```bash
npm run electron:start
```

Build:

```bash
npm run build
```

If you switch between Windows and WSL/Linux, reinstall `node_modules` on the platform where you build. Native packages such as `esbuild` and `lightningcss` are platform-specific.

---

## Documentation

- [User Guide](docs/USER.md)
- [Frontend Developer Guide](docs/FRONTEND_DEVELOPER.md)
- [Quick Reference](docs/QUICK_REFERENCE.md)

---

## License

MIT
