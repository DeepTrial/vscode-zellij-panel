# Zellij Panel for VS Code（中文）

[![版本](https://img.shields.io/github/v/release/DeepTrial/vscode-zellij-panel?style=flat)](https://github.com/DeepTrial/vscode-zellij-panel/releases)
[![许可证](https://img.shields.io/github/license/DeepTrial/vscode-zellij-panel?style=flat)](LICENSE)

在 VS Code 面板中运行 **Zellij**（基于官方 `Pseudoterminal` API，由 VS Code 原生终端界面渲染），并将 **Claude Code** 的文件编辑以 diff 形式可视化。

## 功能

- Zellij 运行在真实伪终端支持的面板中，无需自行实现 xterm.js。
- 可配置会话模式：**new**（新建会话）或 **attach**（接入已有会话）。
- 可选的 Claude Code 编辑捕获（`listenClaude`）：
  - 本地 hook 接收器接收 Claude Code 的 `PreToolUse` / `PostEdit` 事件，编辑前快照文件，编辑后自动打开 `vscode.diff`。
  - 文件系统监听器作为兜底（记录最近已知快照），未配置 hook 时仍可用。
- 可通过一项设置完全关闭捕获。

## 设置

| 设置 | 默认值 | 说明 |
|---|---|---|
| `vscode-zellij-panel.sessionMode` | `new` | `new` = 新建会话；`attach` = 接入 `attachName` |
| `vscode-zellij-panel.attachName` | `""` | attach 模式下的会话名 |
| `vscode-zellij-panel.listenClaude` | `true` | 启用 Claude Code 编辑捕获（hook + 监听） |
| `vscode-zellij-panel.hookPort` | `3910` | hook 接收器本地端口 |

## 用法

1. 执行 `Zellij Panel: Open Session` 打开 Zellij 面板。
2. 若 `listenClaude` 开启，运行一次 `Zellij Panel: Install Claude Code Hook` 将 hook 写入 `~/.claude/settings.json`，重启 Claude Code。
3. 在 Zellij 中启动 `claude`，编辑文件时会自动弹出 diff。

## 构建

```bash
npm install
npm run compile
```

## 测试与 CI

```bash
npm test          # 本地无头测试（需 xvfb）
```

- `ci.yml`：推送/PR 到 `main` 时运行 lint、打包 vsix、无头测试。
- `release.yml`：推送 `v*` tag 时构建 vsix 并发布到 GitHub Release。
