# CTFDeck App - User Guide

CTFDeck App is an interactive terminal application designed for cybersecurity professionals and CTF (Capture The Flag) competitors. It provides a modern desktop interface to execute shell commands remotely with ANSI color support and autocompletion.

> **Note:** This application requires the CTFDeck Backend server to function. See the [Backend User Guide](https://github.com/CTFDeck/ctfdeck-back/blob/main/docs/USER.md) for server installation and configuration.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [User Interface](#user-interface)
- [Features](#features)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Server Configuration](#server-configuration)
- [Troubleshooting](#troubleshooting)

---

## Installation

### Prerequisites

- CTFDeck Backend server running (see [Backend Installation Guide](https://github.com/CTFDeck/ctfdeck-back/blob/main/docs/USER.md#installation))

### Download the application

Download the latest release from [GitHub Releases](https://github.com/CTFDeck/ctfdeck-app/releases):

| Platform | Archive | Contains |
|----------|---------|----------|
| Windows | `release-win-x64.zip` | `.exe` installer |
| Linux | `release-linux-x64.zip` | `.AppImage` |
| macOS | `release-osx-x64.zip` | `.dmg` installer |

### Build from source (optional)

For developers who want to build from source:

```bash
git clone https://github.com/CTFDeck/ctfdeck-app.git
cd ctfdeck-app
npm install
npm run electron:start
```

---

## Quick Start

> **Important:** Make sure the CTFDeck Backend server is running before connecting. See [Starting the Backend Server](https://github.com/CTFDeck/ctfdeck-back/blob/main/docs/USER.md#quick-start).

### 1. Start the application

Run the downloaded installer or AppImage.

### 2. Connect to a server

The application connects automatically to `ws://localhost:42712` by default.

To connect to a different server, click on the connection indicator and enter a custom URL.

### 3. Execute commands

Type a command in the input area and press `Enter`.

---

## User Interface

### Menu Bar

| Menu | Description |
|------|-------------|
| **Target** | Target management (machines, IPs) |
| **Scripts** | Predefined scripts (Web, Reverse shell, Reverse engineering) |
| **Tools** | Links to security tools (NMAP, Gobuster, Nikto, Burp) |
| **Documentation** | Access to user and developer documentation |

### Connection Indicator

- **Green circle**: Connected to server
- **Red circle**: Disconnected

Click the indicator to open server configuration.

### Theme Toggle

Click the sun/moon icon to switch between light and dark themes. Your preference is saved automatically.

### Terminal Area

The main area displays:
- Command prompt with current directory
- Command output with ANSI colors
- Error messages in red

### Input Area

Type commands at the bottom of the screen. Press `Enter` to execute.

---

## Features

### Command Execution

Execute shell commands with real-time streaming output:

```bash
ls -la
cat /etc/passwd
nmap -sV 192.168.1.1
```

### Autocompletion

Intelligent file and directory autocompletion:

1. Start typing a filename
2. Suggestions appear automatically
3. Press `Tab` to complete

File types are color-coded:
- **Directories** - blue
- **Archives** - yellow (.zip, .tar, .gz, .7z, .rar)
- **Executables** - red (.exe, .sh, .bat, .cmd)
- **Images** - green (.png, .jpg, .gif, .svg, .webp)
- **Text files** - grey (.txt, .md, .json, .js, .ts, .html, .css)

### Command History

Navigate through previous commands:
- `Up Arrow`: Previous command
- `Down Arrow`: Next command

### Directory Navigation

```bash
cd /home/user        # Absolute path
cd Documents         # Relative path
cd ~                 # Home directory
cd ..                # Parent directory
pwd                  # Display current directory
```

The prompt updates to show the current working directory.

### Color Support

ANSI color codes are rendered automatically. Commands like `ls`, `grep`, and `diff` display colored output. The backend automatically injects color flags for supported commands (see [Backend Color Support](https://github.com/CTFDeck/ctfdeck-back/blob/main/docs/USER.md#color-support)).

### Clear Terminal

```bash
clear    # Linux/macOS
cls      # Windows
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Execute command |
| `Tab` | Autocompletion |
| `Up Arrow` | Previous command |
| `Down Arrow` | Next command |

---

## Server Configuration

For detailed information about the backend server configuration, security considerations, and technical limits, see the [Backend User Guide](https://github.com/CTFDeck/ctfdeck-back/blob/main/docs/USER.md#configuration).

### Add a Server

1. Click the connection indicator
2. Enter the server URL (e.g., `ws://192.168.1.100:42712`)
3. Click **Save** to store it, or **Connect** to connect directly

### Connect to a Server

1. Click the connection indicator
2. Select a saved server from the list
3. The connection is established automatically

### Default Server

The default server URL is `ws://localhost:42712`.

---

## Troubleshooting

For server-side issues (port conflicts, permissions, timeouts), see the [Backend Troubleshooting Guide](https://github.com/CTFDeck/ctfdeck-back/blob/main/docs/USER.md#troubleshooting).

### "Disconnected" status

**Causes:**
- Backend server not running
- Incorrect server URL
- Firewall blocking connection

**Solutions:**
1. Start the CTFDeck Backend server
2. Verify the URL in connection settings
3. Check that port 42712 is accessible

### Commands not executing

**Causes:**
- Command timeout (5 minute limit)
- Connection lost

**Solutions:**
1. Split long commands into smaller steps
2. Reconnect to the server

### Colors not displaying

**Cause:** Command doesn't support color flags

**Solution:** Add `--color=always` manually to commands

### Autocompletion not working

**Cause:** File list not loaded

**Solution:** Run `ls` to refresh available files

---

## Supported Platforms

| Platform | Status |
|----------|--------|
| Windows 10+ (x64) | Supported |
| Linux (x64) | Supported |
| macOS (x64) | Supported |

---

## External Resources

The **Tools** menu provides quick access to:

- [CVE.org](https://cve.org) - Vulnerability database
- [ExploitDB](https://exploit-db.com) - Exploit database
- Tool documentation: NMAP, Gobuster, Nikto, Burp Suite
