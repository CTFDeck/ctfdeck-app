# CTFDeck App - User Guide

CTFDeck App is an interactive workspace for CTF players and security practitioners. It combines a remote terminal, target manager, command runner, jobs panel, write-up editor, project organization, and tool installation UI.

The app requires the CTFDeck backend server. See the [Backend User Guide](https://github.com/CTFDeck/ctfdeck-back/blob/main/docs/USER.md) for server installation and configuration.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [User Interface](#user-interface)
- [Terminal](#terminal)
- [Targets](#targets)
- [Command Runner and Jobs](#command-runner-and-jobs)
- [Tools](#tools)
- [Write-ups](#write-ups)
- [Projects](#projects)
- [Server Configuration](#server-configuration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)
- [Supported Platforms](#supported-platforms)

---

## Installation

### Prerequisites

- CTFDeck backend server running.
- A WebSocket endpoint reachable from the app. The default is `ws://localhost:42712`.

### Download the application

Download the latest release from [GitHub Releases](https://github.com/CTFDeck/ctfdeck-app/releases).

| Platform | Package | Contains |
|----------|---------|----------|
| Windows | `release-win-x64.zip` | `.exe` installer |
| Linux | `release-linux-x64.zip` | `.AppImage` |
| macOS | `release-osx-x64.zip` | `.dmg` installer |

### Build from source

```bash
git clone https://github.com/CTFDeck/ctfdeck-app.git
cd ctfdeck-app
npm install
npm run electron:start
```

If you build from WSL/Linux after installing dependencies on Windows, reinstall dependencies in WSL/Linux first:

```bash
rm -rf node_modules
npm install
```

Native packages such as `esbuild` and `lightningcss` are platform-specific.

---

## Quick Start

1. Start the CTFDeck backend server.
2. Start CTFDeck App.
3. Confirm the connection indicator is connected to `ws://localhost:42712`, or configure another server.
4. Create or select a session from the sidebar.
5. Add targets if you want to use command templates.
6. Run commands from the terminal or use the Command Runner.
7. Save findings into write-ups and organize them in projects.

---

## User Interface

### Sidebar

The sidebar contains:

- Recent terminal sessions.
- Recent write-ups.
- Project folders with attached sessions and write-ups.
- Actions to create, rename, open, and delete workspace items.

### Menu Bar

| Area | Description |
|------|-------------|
| Targets | Open target manager, add targets, edit targets, delete targets |
| Command Runner | Run tool templates and custom scripts |
| Tools | View tool inventory and install missing tools |
| Projects | Create, import, export, and organize projects |
| Documentation | Open user/developer docs |
| Theme/Language | Switch theme and UI language |

### Connection Indicator

- Green: connected to the backend.
- Red: disconnected.

Click the indicator to configure the WebSocket server URL.

---

## Terminal

The terminal supports real-time command execution through the backend.

Examples:

```bash
pwd
ls -la
cd ~/ctf
nmap -sV 127.0.0.1
```

### Streaming Output

Output is streamed while commands run. ANSI colors are rendered automatically, and common tools such as `ls`, `grep`, and `diff` can display colors through backend color support.

### Interactive Commands

Commands can receive stdin while they are running. This supports prompts such as:

```bash
sudo apt remove nmap
```

When a command is active, the input prompt switches to the running command name. Type the answer and press `Enter`.

### Signals

- `Ctrl+C`: interrupt the active command.
- `Ctrl+D`: send EOF to the active command.

### Autocompletion

Start typing a file or directory name and press `Tab`.

File types are color-coded:

- Directories: blue
- Archives: yellow
- Executables: red
- Images: green
- Text/code files: grey

Run `ls` if the autocomplete cache needs to refresh.

### Selection Actions

Select terminal output and right-click to:

- Copy the selection.
- Add it to the most recent write-up.
- Add it to a project write-up.
- Choose a specific write-up.

---

## Targets

Targets represent machines, services, hosts, or challenge endpoints.

Typical target data:

- Name
- Address or host
- Port
- Type
- Description

Targets can be used by command templates in the Command Runner, for example:

```bash
nmap -sV {host} -p {port}
```

---

## Command Runner and Jobs

The Command Runner helps execute repeatable commands against selected targets.

### Running a Command

1. Open Command Runner.
2. Select a target.
3. Select a tool or custom script.
4. Review or edit the generated command.
5. Click Run.

Commands run in the background. The Jobs button shows active jobs and opens the Jobs panel.

### Jobs Panel

The Jobs panel lets you:

- View running and completed commands.
- Stream command output.
- Stop a running job.
- Restart a completed job.
- Remove a job.
- Clear completed jobs.

Job output is displayed with terminal-style whitespace and horizontal scrolling for very long lines.

### Custom Scripts

You can create custom command templates with categories such as Recon, Web, Crypto, Pwn, Forensics, Reverse, and Misc.

Templates can include target placeholders such as `{host}` and `{port}`.

---

## Tools

The Tools view uses backend inventory and catalog data.

You can:

- See installed and missing tools.
- Install selected missing tools.
- Uninstall supported tools.
- Follow installation progress.
- Provide sudo credentials when the backend needs elevated privileges.

Tool installation behavior depends on the backend and host operating system.

---

## Write-ups

Write-ups are Markdown notes stored through the backend.

You can:

- Create, rename, open, and delete write-ups.
- Edit Markdown content.
- Preview rendered Markdown.
- Add selected terminal output directly into a write-up.
- Keep write-ups global or attach them to projects.

---

## Projects

Projects group sessions, write-ups, targets, media, and scripts into a portable workspace.

Project features include:

- Create projects.
- Organize sessions and write-ups under projects and folders.
- Export one or more projects.
- Import exported projects.
- Choose export options for history, targets, write-ups, media, and scripts.

Imported/exported data is handled by the backend.

---

## Server Configuration

### Default Server

```text
ws://localhost:42712
```

### Add or Connect to a Server

1. Click the connection indicator.
2. Enter a WebSocket URL.
3. Save it or connect directly.

Example:

```text
ws://192.168.1.100:42712
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Execute command or send input to active command |
| `Tab` | Autocomplete terminal path |
| `Up Arrow` | Previous command |
| `Down Arrow` | Next command |
| `Ctrl+C` | Interrupt active command |
| `Ctrl+D` | Send EOF to active command |

---

## Troubleshooting

### Disconnected status

Possible causes:

- Backend server is not running.
- WebSocket URL is incorrect.
- Firewall or network rules block the connection.

Fixes:

1. Start the backend.
2. Verify the URL in connection settings.
3. Check that port `42712` is reachable.

### Command does not run

Possible causes:

- Backend disconnected.
- Session is still loading.
- Command timed out.

Fixes:

1. Reconnect to the backend.
2. Wait for session loading to finish.
3. Split long commands into smaller steps.

### Sudo or confirmation prompt does not accept input

Make sure the backend is up to date. Interactive commands require backend stdin routing and pseudo-terminal support for commands that need a TTY.

### Output has long escaped lines

Some tools, including `nmap -sV`, intentionally print escaped payloads or service fingerprints. CTFDeck preserves tool output instead of rewriting it. The Jobs panel supports horizontal scrolling for long lines.

### Autocompletion does not show expected files

Run:

```bash
ls
```

This refreshes the terminal file cache.

### Frontend build fails in WSL after installing on Windows

Native Node packages are platform-specific. Reinstall dependencies on the platform where you build:

```bash
rm -rf node_modules
npm install
```

---

## Supported Platforms

| Platform | Status |
|----------|--------|
| Windows 10+ x64 | Supported |
| Linux x64 | Supported |
| macOS x64 | Supported |

Behavior of shell commands depends on the backend host OS and installed shell/toolchain.
