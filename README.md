# Zellij Panel for VS Code

[![Version](https://img.shields.io/github/v/release/DeepTrial/vscode-zellij-panel?style=flat)](https://github.com/DeepTrial/vscode-zellij-panel/releases)
[![License](https://img.shields.io/github/license/DeepTrial/vscode-zellij-panel?style=flat)](LICENSE)

> 📘 中文文档：[README.zh.md](./README.zh.md)

Run **Zellij** inside a VS Code panel (via the official `Pseudoterminal` API, rendered by VS Code's native terminal UI) and visualize **Claude Code** file edits as diffs.

## Features

- Zellij runs in a real pseudoterminal-backed panel — no xterm.js reimplementation.
- Configurable session mode: **new** (fresh session) or **attach** (existing session name).
- Optional Claude Code edit capture (`listenClaude`):
  - A local hook receiver gets `PreToolUse` / `PostEdit` events from Claude Code, snapshots the file before the edit, and opens a `vscode.diff` when the edit lands.
  - File-system watcher acts as a fallback (last-known snapshot) when hooks aren't configured.
- Turn capture off entirely with one setting.

## Settings

| Setting | Default | Description |
|---|---|---|
| `vscode-zellij-panel.sessionMode` | `new` | `new` = create session; `attach` = attach to `attachName` |
| `vscode-zellij-panel.attachName` | `""` | Session name for attach mode |
| `vscode-zellij-panel.listenClaude` | `true` | Enable Claude Code edit capture (hook + watcher) |
| `vscode-zellij-panel.hookPort` | `3910` | Local port for the hook receiver |

## Usage

1. `Zellij Panel: Open Session` — opens the Zellij panel.
2. If `listenClaude` is on, run `Zellij Panel: Install Claude Code Hook` once to write the hook into `~/.claude/settings.json`, then restart Claude Code.
3. Inside Zellij, start `claude`. When it edits a file, a diff opens automatically.

## Build

```bash
npm install
npm run compile
```

## Testing & CI

```bash
npm test          # local headless test (requires xvfb)
```

- `ci.yml`: on push/PR to `main` — runs lint, packages the vsix, and runs headless tests.
- `release.yml`: on `v*` tag push — builds the vsix and publishes it to GitHub Releases.
