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

  it('should not falsely reject a command with declared args and its own command-scoped option', function () {
    const tempDir = createTempProject({
      commands: {
        greet: {
          desc: 'Greet a person',
          args: [
            {
              name: 'name',
              rules: []
            }
          ],
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

  describe('rules', function () {
    const commandsConfig = {
      options: [
        {
          arg: '--port <port>',
          desc: 'Port number',
          rules: ['int']
        }
      ],
      commands: {
        notify: {
          desc: 'Notify someone',
          args: [
            {
              name: 'recipient',
              rules: ['email']
            }
          ]
        },
        deploy: {
          desc: 'Deploy the app',
          options: [
            {
              arg: '--env <env>',
              desc: 'Target environment',
              rules: ['required']
            }
          ]
        },
        build: {
          desc: 'Build the app',
          options: [
            {
              arg: '--target <target>',
              desc: 'Build target',
              rules: ['required']
            }
          ]
        }
      }
    };
    // build intentionally has no action handler
    const actionSource = `{
      commands: {
        notify: {
          action: function (opts) {
            console.log(JSON.stringify({ args: opts.args, port: opts.port }));
          }
        },
        deploy: {
          action: function (opts) {
            console.log(JSON.stringify({ env: opts.env }));
          }
        }
      }
    }`;
    let tempDir;

    beforeEach(function () {
      tempDir = createTempProject(commandsConfig);
    });

    afterEach(function () {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should run the action when arguments and options satisfy their rules', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', '--port', '8080', 'notify', 'ada@example.com'], actionSource);

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '{"args":["ada@example.com"],"port":"8080"}\n');
      assert.equals(result.stderr, '');
    });

    it('should exit with an error without running the action when an argument does not satisfy its rule', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', '--port', '8080', 'notify', 'ada'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.isTrue(result.stderr.includes('Invalid argument: <recipient> must be email'));
    });

    it('should exit with an error without running the action when a global option does not satisfy its rule', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', '--port', 'abc', 'notify', 'ada@example.com'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.isTrue(result.stderr.includes('Invalid option: <--port <port>> must be int'));
    });

    it('should exit with an error without running the action when a required command option is omitted', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', '--port', '8080', 'deploy'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.isTrue(result.stderr.includes('Invalid option: <--env <env>> must be required'));
    });

    it('should still exit with an error when a required command option is omitted on a command without action handler', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', '--port', '8080', 'build'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.isTrue(result.stderr.includes('Invalid option: <--target <target>> must be required'));
    });

    it('should exit without error when a command without action handler satisfies its rules', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', '--port', '8080', 'build', '--target', 'web'], actionSource);

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '');
      assert.equals(result.stderr, '');
    });
  });

  describe('choices', function () {
    const commandsConfig = {
      options: [
        {
          arg: '--log-level <logLevel>',
          desc: 'Log level',
          choices: ['info', 'debug']
        }
      ],
      commands: {
        serve: {
          desc: 'Start the server',
          options: [
            {
              arg: '--transport <transport>',
              desc: 'Transport type',
              choices: ['stdio', 'streamable-http']
            }
          ]
        },
        export: {
          desc: 'Export the data',
          options: [
            {
              arg: '--format <format>',
              desc: 'Output format',
              choices: ['json', 'yaml-1'],
              rules: ['alphaNumeric']
            }
          ]
        },
        deploy: {
          desc: 'Deploy the app',
          options: [
            {
              arg: '--env <env>',
              desc: 'Target environment',
              choices: ['staging', 'production'],
              rules: ['required']
            }
          ]
        }
      }
    };
    const actionSource = `{
      commands: {
        serve: {
          action: function (opts) {
            console.log(JSON.stringify({ transport: opts.transport, logLevel: opts.logLevel }));
          }
        },
        export: {
          action: function (opts) {
            console.log(JSON.stringify({ format: opts.format }));
          }
        },
        deploy: {
          action: function (opts) {
            console.log(JSON.stringify({ env: opts.env }));
          }
        }
      }
    }`;
    let tempDir;

    beforeEach(function () {
      tempDir = createTempProject(commandsConfig);
    });

    afterEach(function () {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should pass a command option value to the action when it is one of the choices', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'serve', '--transport', 'streamable-http'], actionSource);

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '{"transport":"streamable-http"}\n');
      assert.equals(result.stderr, '');
    });

    it('should exit with an error without running the action when a command option value is not one of the choices', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'serve', '--transport', 'sse'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.equals(
        result.stderr,
        "error: option '--transport <transport>' argument 'sse' is invalid. Allowed choices are stdio, streamable-http.\n"
      );
    });

    it('should pass a global option value to the action when it is one of the choices', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', '--log-level', 'debug', 'serve'], actionSource);

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '{"logLevel":"debug"}\n');
      assert.equals(result.stderr, '');
    });

    it('should exit with an error without running the action when a global option value is not one of the choices', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', '--log-level', 'trace', 'serve'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.equals(
        result.stderr,
        "error: option '--log-level <logLevel>' argument 'trace' is invalid. Allowed choices are info, debug.\n"
      );
    });

    it('should run the action without error when options with choices are omitted', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'serve'], actionSource);

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '{}\n');
      assert.equals(result.stderr, '');
    });

    it('should list the choices of a global option in the help output', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', '--help'], actionSource);

      assert.equals(result.status, 0);
      assert.isTrue(result.stdout.includes('(choices: "info", "debug")'));
    });

    it('should list the choices of a command option in the command help output', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'serve', '--help'], actionSource);

      assert.equals(result.status, 0);
      assert.isTrue(result.stdout.includes('(choices: "stdio", "streamable-http")'));
    });

    it('should pass an option value to the action when it is one of the choices and satisfies its rule', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'export', '--format', 'json'], actionSource);

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '{"format":"json"}\n');
      assert.equals(result.stderr, '');
    });

    it('should exit with the rule error when an option value is one of the choices but does not satisfy its rule', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'export', '--format', 'yaml-1'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.isTrue(result.stderr.includes('Invalid option: <--format <format>> must be alphaNumeric'));
    });

    it('should exit with the choices error when an option value is not one of the choices even though it satisfies its rule', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'export', '--format', 'xml'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.equals(
        result.stderr,
        "error: option '--format <format>' argument 'xml' is invalid. Allowed choices are json, yaml-1.\n"
      );
    });

    it('should pass an option value to the action when it is one of the choices and the option is required', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'deploy', '--env', 'staging'], actionSource);

      assert.equals(result.status, 0);
      assert.equals(result.stdout, '{"env":"staging"}\n');
      assert.equals(result.stderr, '');
    });

    it('should exit with the required rule error when an option with choices and required rule is omitted', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'deploy'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.isTrue(result.stderr.includes('Invalid option: <--env <env>> must be required'));
    });

    it('should exit with the choices error without running the action when an option with required rule is not one of the choices', function () {
      const result = runScenario(tempDir, ['node', 'cli.js', 'deploy', '--env', 'dev'], actionSource);

      assert.equals(result.status, 1);
      assert.equals(result.stdout, '');
      assert.equals(
        result.stderr,
        "error: option '--env <env>' argument 'dev' is invalid. Allowed choices are staging, production.\n"
      );
    });
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