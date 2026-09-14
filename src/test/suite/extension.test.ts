import * as assert from 'assert';
import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

// `suite` / `test` are provided as globals by the programmatic Mocha runner
// in ./index.ts (TDD interface). Do NOT import them from 'mocha' here.

// The extension uses `onCommand` activation events, so it is NOT activated
// merely by being loaded. We must activate it (or trigger one of its
// commands) before asserting that its commands are registered. The full id
// is `<publisher>.vscode-zellij-panel`; resolve it dynamically to avoid
// hard-coding the publisher.
async function ensureActivated(): Promise<void> {
  const ext = vscode.extensions.all.find((e) =>
    e.id.endsWith('vscode-zellij-panel'),
  );
  assert.ok(ext, 'extension vscode-zellij-panel not found');
  if (!ext.isActive) {
    await ext.activate();
  }
}

suite('Zellij Panel Extension', () => {
  vscode.window.showInformationMessage('Starting Zellij Panel tests.');

  test('commands are registered', async () => {
    await ensureActivated();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('vscode-zellij-panel.open'),
      'open command not registered',
    );
    assert.ok(
      commands.includes('vscode-zellij-panel.installHook'),
      'installHook command not registered',
    );
  });

  test('installHook writes Claude Code settings', async () => {
    await ensureActivated();
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    const backup = fs.existsSync(settingsPath)
      ? fs.readFileSync(settingsPath, 'utf8')
      : null;
    try {
      await vscode.commands.executeCommand('vscode-zellij-panel.installHook');
      assert.ok(fs.existsSync(settingsPath), 'settings.json not created');
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.ok(settings.hooks, 'hooks object missing');
      assert.ok(
        Array.isArray(settings.hooks.PreToolUse),
        'PreToolUse hook missing',
      );
      assert.ok(Array.isArray(settings.hooks.PostEdit), 'PostEdit hook missing');
      assert.ok(
        settings.hooks.PreToolUse[0].command.includes('localhost'),
        'hook command should target localhost',
      );
    } finally {
      if (backup !== null) {
        fs.writeFileSync(settingsPath, backup);
      } else if (fs.existsSync(settingsPath)) {
        fs.unlinkSync(settingsPath);
      }
    }
  });

  test('sidebar view is contributed', async () => {
    const ext = vscode.extensions.all.find((e) =>
      e.id.endsWith('vscode-zellij-panel'),
    );
    assert.ok(ext, 'extension vscode-zellij-panel not found');
    const views =
      ext!.packageJSON?.contributes?.views?.['zellij-panel'] ||
      ext!.packageJSON?.contributes?.views?.['zellij-panel.actions'];
    assert.ok(views, 'zellij-panel views container not contributed');
    const hasActions = (views as any[]).some(
      (v) => v.id === 'zellij-panel.actions',
    );
    assert.ok(hasActions, 'zellij-panel.actions view not contributed');
  });
});
