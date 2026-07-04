"use strict";

import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import referee from '@sinonjs/referee';
import { fileURLToPath, pathToFileURL } from 'url';

const assert = referee.assert;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const packageModuleUrl = pathToFileURL(path.join(repoRoot, 'lib', 'bagofcli.js')).href;

function createTempProject(commandsConfig) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'bagofcli-integration-'));

  mkdirSync(path.join(tempDir, 'lib'));
  mkdirSync(path.join(tempDir, 'conf'));

  writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  writeFileSync(path.join(tempDir, 'conf', 'commands.json'), JSON.stringify(commandsConfig, null, 2));

  return tempDir;
}

function runScenario(tempDir, argv, actionSource) {
  const script = [
    `import bag from ${JSON.stringify(packageModuleUrl)};`,
    `const actions = ${actionSource};`,
    `process.argv = ${JSON.stringify(argv)};`,
    `bag.command(${JSON.stringify(path.join(tempDir, 'lib'))}, actions);`
  ].join('\n');

  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8'
  });
}

describe('bagofcli - integration', function () {

  it('should execute a configured command and pass positional arguments to the action', function () {
    const tempDir = createTempProject({
      commands: {
        greet: {
          desc: 'Greet a person',
          args: [
            {
              name: 'name',
              rules: []
            }
          ]
        }
      }
    });

    try {
      const result = runScenario(
        tempDir,
        ['node', 'cli.js', 'greet', 'Ada'],
        `{
          commands: {
            greet: {
              action: function (name) {
                console.log(JSON.stringify({ args: name.args, name: name.name() }));
              }
            }
          }
        }`
      );

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '{"args":["Ada"],"name":"greet"}\n');
      assert.equals(result.stderr, '');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should exit with an error when an unknown command is passed', function () {
    const tempDir = createTempProject({
      commands: {
        greet: {
          desc: 'Greet a person',
          args: [
            {
              name: 'name'
            }
          ]
        }
      }
    });

    try {
      const result = runScenario(
        tempDir,
        ['node', 'cli.js', 'unknown'],
        `{
          commands: {
            greet: {
              action: function () {
                console.log('should not run');
              }
            }
          }
        }`
      );

      assert.equals(result.status, 1);
      assert.isTrue(result.stderr.includes("unknown command 'unknown'"));
      assert.equals(result.stdout, '');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});