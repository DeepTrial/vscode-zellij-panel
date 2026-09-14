import * as path from 'path';
import * as fs from 'fs';
import Mocha = require('mocha');

// Programmatic Mocha runner. We set up the TDD interface ourselves instead of
// relying on the VS Code extension test host injecting `suite`/`test` as
// globals (fragile / version-dependent). Mocha attaches those globals to the
// module scope of every file added via `addFile`, so the *.test.ts suites can
// keep using the `suite`/`test` TDD syntax.
export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 30000,
  });

  const testsRoot = __dirname;
  const files = fs
    .readdirSync(testsRoot)
    .filter((f) => f.endsWith('.test.js'))
    .map((f) => path.resolve(testsRoot, f));

  files.forEach((f) => mocha.addFile(f));

  return new Promise<void>((resolve, reject) => {
    mocha.run((failures: number) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
      } else {
        resolve();
      }
    });
  });
}
