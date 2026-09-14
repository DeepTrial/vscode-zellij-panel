import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { spawn } from 'child_process';
// NOTE: node-pty is a native module. Requiring it at the top level would crash
// the whole extension activation on platforms without a usable prebuild, leaving
// the commands unregistered ("command not found"). We load it lazily inside the
// function that needs it so activation + command registration always succeed.

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------
function cfg<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration('vscode-zellij-panel').get<T>(key, fallback);
}

// ---------------------------------------------------------------------------
// Local hook receiver (only used when listenClaude is true)
// ---------------------------------------------------------------------------
// Receives PreToolUse / PostEdit events from Claude Code. PreToolUse snapshots
// the file before the edit; PostEdit shows a diff against that snapshot.
const snapshots = new Map<string, string>(); // filePath -> before-content
let server: http.Server | undefined;

function startHookServer(port: number): void {
  server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return;
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const evt = JSON.parse(body);
        const tool = evt.hook_event_name || '';
        const input = evt.tool_input || {};
        const filePath: string | undefined = input.file_path;
        if (filePath && fs.existsSync(filePath)) {
          if (tool.includes('PreToolUse')) {
            snapshots.set(filePath, fs.readFileSync(filePath, 'utf8'));
          } else if (tool.includes('PostEdit') || tool.includes('PostToolUse')) {
            showDiff(filePath);
          }
        }
      } catch {
        // ignore malformed payloads
      }
      res.statusCode = 200;
      res.end();
    });
  });
  server.listen(port);
}

function stopHookServer(): void {
  server?.close();
  server = undefined;
  snapshots.clear();
}

// ---------------------------------------------------------------------------
// Diff manager: hook snapshot (before) vs disk (after); FSWatcher fallback
// ---------------------------------------------------------------------------
const fileCache = new Map<string, string>(); // last-known content (FSW fallback)
let watcher: vscode.FileSystemWatcher | undefined;

function showDiff(filePath: string): void {
  const afterUri = vscode.Uri.file(filePath);
  const before = snapshots.get(filePath) ?? fileCache.get(filePath) ?? '';
  const beforePath = path.join(os.tmpdir(), 'zellij-panel-before-' + path.basename(filePath));
  fs.writeFileSync(beforePath, before);
  const beforeUri = vscode.Uri.file(beforePath);
  vscode.commands.executeCommand('vscode.diff', beforeUri, afterUri, `Zellij: ${path.basename(filePath)} (before → after)`);
}

function startFileWatcher(): void {
  watcher = vscode.workspace.createFileSystemWatcher('**/*');
  watcher.onDidChange((uri) => {
    const p = uri.fsPath;
    if (fs.existsSync(p)) {
      fileCache.set(p, fs.readFileSync(p, 'utf8'));
    }
  });
}

function stopFileWatcher(): void {
  watcher?.dispose();
  watcher = undefined;
}

// ---------------------------------------------------------------------------
// Pseudoterminal that runs Zellij
// ---------------------------------------------------------------------------
// NOTE: We deliberately avoid node-pty (a native module). On VS Code Remote
// Linux the bundled native .node fails to dlopen inside the extension host
// (ABI/glibc isolation), so we bridge Zellij with the built-in
// child_process.spawn + a pipe, feeding stdout/stderr into the pseudoterminal
// and writing user keystrokes to the child's stdin. No native deps required.
class ZellijPty implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  private closeEmitter = new vscode.EventEmitter<number>();
  private child: ReturnType<typeof spawn> | undefined;

  onDidWrite = this.writeEmitter.event;
  onDidClose = this.closeEmitter.event;

  open(): void {
    const mode = cfg<string>('sessionMode', 'new');
    const attach = cfg<string>('attachName', '');
    let args: string[];
    if (mode === 'attach' && attach) {
      args = ['attach', attach];
    } else {
      args = ['-s', `zellij-panel-${Date.now()}`];
    }
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir();
    this.child = spawn('zellij', args, {
      cwd,
      env: process.env as Record<string, string>,
    });
    this.child.stdout?.on('data', (d: Buffer) => this.writeEmitter.fire(d.toString()));
    this.child.stderr?.on('data', (d: Buffer) => this.writeEmitter.fire(d.toString()));
    this.child.on('exit', (code) => this.closeEmitter.fire(code ?? 0));
    this.child.on('error', (err) => {
      this.writeEmitter.fire(`\r\n[Zellij Panel] failed to start zellij: ${err.message}\r\n`);
      this.closeEmitter.fire(-1);
    });
  }

  handleInput(data: string): void {
    this.child?.stdin?.write(data);
  }

  setDimensions(_dimensions: vscode.TerminalDimensions): void {
    // Child process inherits the PTY size from the parent terminal; Zellij
    // handles resize via its own SIGWINCH handling, so no explicit resize needed.
  }

  close(): void {
    this.child?.kill();
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
function openPanel(): void {
  const term = vscode.window.createTerminal({
    name: 'Zellij',
    pty: new ZellijPty(),
  } as vscode.ExtensionTerminalOptions);
  term.show();

  const listen = cfg<boolean>('listenClaude', true);
  if (listen) {
    startHookServer(cfg<number>('hookPort', 3910));
    startFileWatcher();
    vscode.window.showInformationMessage('Zellij Panel: listening for Claude Code edits.');
  }
}

function installHook(): void {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const port = cfg<number>('hookPort', 3910);
  const hookEntry = {
    hooks: {
      PreToolUse: [{ type: 'command', command: `curl -s -X POST http://localhost:${port}/hook -d @- >/dev/null` }],
      PostEdit: [{ type: 'command', command: `curl -s -X POST http://localhost:${port}/hook -d @- >/dev/null` }],
    },
  };
  let settings: any = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch {
      settings = {};
    }
  }
  settings.hooks = { ...(settings.hooks || {}), ...hookEntry.hooks };
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  vscode.window.showInformationMessage(`Claude Code hook written to ${settingsPath}. Restart Claude Code to apply.`);
}

// ---------------------------------------------------------------------------
// Sidebar view (activity bar icon + clickable "Open Session" item)
// ---------------------------------------------------------------------------
class ZellijActionsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  getChildren(_element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
    const open = new vscode.TreeItem('Open Zellij Session', vscode.TreeItemCollapsibleState.None);
    open.iconPath = new vscode.ThemeIcon('terminal');
    open.command = {
      command: 'vscode-zellij-panel.open',
      title: 'Open Zellij Session',
    };
    return [open];
  }
}

// ---------------------------------------------------------------------------
// Activate / Deactivate
// ---------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-zellij-panel.open', openPanel),
    vscode.commands.registerCommand('vscode-zellij-panel.installHook', installHook),
  );
  // Register the sidebar view so the activity-bar icon shows a clickable item.
  const treeProvider = new ZellijActionsProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('zellij-panel.actions', treeProvider),
  );
}

export function deactivate(): void {
  stopHookServer();
  stopFileWatcher();
}
