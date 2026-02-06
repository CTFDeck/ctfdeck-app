# CTFDeck – Frontend

## Overview

CTFDeck is a web-based application designed to assist players during Capture The Flag (CTF) challenges.  
This repository contains the **frontend** of the project, built with **Angular**, focusing on a clean, simple, and efficient user interface.

The frontend provides the visual structure of the platform, including navigation, session history, and an integrated terminal view.

---

## Project Status

🚧 **Current stage:** PoC / Milestone 1  
At this stage, the frontend mainly focuses on **UI display and structure**.  
Most features are static or mocked and do not yet interact with real backend logic.

---

## Features

### ✅ Milestone 1 – PoC
- Top navigation bar with dropdown menus:
  - Targets (configuration, add, remove, save)
  - Scripts (Web, Reverse Shell, Reverse Engineering)
  - Utils (external security resources)
  - Documentation (user & developer)
- Sidebar displaying command history (chat-style)
- Main panel with an integrated terminal interface (display only)
- Simple, sober, and readable UI

### ⬜ Milestone 2 – Functional Frontend
- Configuration, addition, and deletion of targets (IP, Port)
- Execution of Web scripts (Basic Discovery, e.g., Nmap, Gobuster)
- Saving and switching between sessions
- Updated UI to reflect dynamic data
- Links to user and developer documentation

### ⬜ Milestone 3 – Full Features
- Saving chats and outputs (all commands, including errors)
- Import/export of targets (JSON or XML)
- Generation of write-ups in Markdown or PDF format
- UI customization and theme adjustments
- Full integration with backend logic and scripts

---

## Tech Stack

- **Angular**
- **TypeScript**
- **HTML / CSS**
- **Electron** (desktop packaging – optional / experimental)
- Shared UI components via `libs/ui` (Spratan-NG)

---

## Licence

- MIT

## Documentation

- 📘 **User documentation**  
  Application Installation and User Guide.  
  👉 [Installation & Usage](https://github.com/CTFDeck/ctfdeck-app/blob/stage/docs/USER.md#installation)
