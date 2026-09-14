import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './extension.test');
    await runTests({
      // Pin a VS Code version whose extension test runner still uses the
      // mocha global-injection model (suite/test). Newer insiders/1.137+
      // changed the runner and break `suite is not defined`.
      version: '1.89.0',
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions', '--disable-gpu'],
    });
  } catch (err) {
    console.error('Failed to run tests', err);
    process.exit(1);
  }
}

main();
