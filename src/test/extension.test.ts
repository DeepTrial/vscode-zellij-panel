import * as assert from 'assert';
import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
// `suite` / `test` are injected as globals by @vscode/test-electron's mocha runner.

suite('Zellij Panel Extension', () => {
  vscode.window.showInformationMessage('Starting Zellij Panel tests.');

  test('commands are registered', async () => {
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
});
