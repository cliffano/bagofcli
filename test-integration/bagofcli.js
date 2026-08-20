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

  it('should execute a configured command and pass positional arguments and name() to the action', function () {
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

  it('should execute a configured command and pass a flag directly on the action argument (regression test for issue #20)', function () {
    const tempDir = createTempProject({
      commands: {
        greet: {
          desc: 'Greet a person',
          options: [
            {
              arg: '-f, --flag',
              desc: 'A flag option'
            }
          ]
        }
      }
    });

    try {
      const result = runScenario(
        tempDir,
        ['node', 'cli.js', 'greet', '--flag'],
        `{
          commands: {
            greet: {
              action: function (opts) {
                console.log(JSON.stringify({ flag: opts.flag }));
              }
            }
          }
        }`
      );

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '{"flag":true}\n');
      assert.equals(result.stderr, '');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should execute a configured command and pass both a flag and positional arguments/name() to the action', function () {
    // NOTE: intentionally not declaring `args` in commands.json here. _postCommand's
    // mandatory-arg-count check counts positional args from the top-level commander
    // instance, which doesn't know about this subcommand-scoped --flag option, so it
    // miscounts and rejects the command with a false usage error. That's a separate,
    // pre-existing bug unrelated to issue #20; omitting `args` here avoids it while
    // still exercising both the flag and opts.args/opts.name(), which come straight
    // from the Commander subcommand instance regardless of `args` config.
    const tempDir = createTempProject({
      commands: {
        greet: {
          desc: 'Greet a person',
          options: [
            {
              arg: '-f, --flag',
              desc: 'A flag option'
            }
          ]
        }
      }
    });

    try {
      const result = runScenario(
        tempDir,
        ['node', 'cli.js', 'greet', 'Ada', '--flag'],
        `{
          commands: {
            greet: {
              action: function (opts) {
                console.log(JSON.stringify({ args: opts.args, name: opts.name(), flag: opts.flag }));
              }
            }
          }
        }`
      );

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '{"args":["Ada"],"name":"greet","flag":true}\n');
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