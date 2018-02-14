var buster = require('buster-node'),
  async = require('async'),
  bag = require('../lib/bagofcli'),
  childProcess = require('child_process'),
  colors = require('colors'),
  commander = require('commander'),
  fs = require('fs'),
  prompt = require('prompt'),
  referee = require('referee'),
  wrench = require('wrench'),
  assert = referee.assert,
  refute = referee.refute;

buster.testCase('cli - command', {
  setUp: function () {
    this.mockCommander = this.mock(commander);
    this.mockFs = this.mock(fs);
    this.base = '/some/dir';
    this.actions = {
      commands: {
        command1: { action1: function () {} },
        command2: { action2: function () {} },
        command3: { action3: function () {} }
      }
    };
    this.commands = {
      commands: {
        command1: {
          desc: 'Command1 description',
          options: [
            {
              arg: '-f, --flag',
              desc: 'Flag description'
            }
          ]
        },
        command2: {
          desc: 'Command2 description'
        }
      }
    };
    this.mockFs.expects('readFileSync').once().withExactArgs('/some/package.json').returns(JSON.stringify({ version: '1.2.3' }));
  },
  'should use optional command file when specified': function () {
    this.mockCommander.expects('version').once().withExactArgs('1.2.3');
    this.mockCommander.expects('parse').once().withExactArgs(['arg1', 'arg2']);
    this.mockFs.expects('readFileSync').once().withExactArgs('/some/dir/commands.json').returns(JSON.stringify(this.commands));
    this.stub(process, 'argv', ['arg1', 'arg2']);
    bag.command(this.base, this.actions, {
      commandFile: 'commands.json'
    });
  },
  'should fall back to default command file location when optional command file is not specified': function () {
    this.mockCommander.expects('version').once().withExactArgs('1.2.3');
    this.mockCommander.expects('parse').once().withExactArgs(['arg1', 'arg2']);
    this.mockFs.expects('readFileSync').once().withExactArgs('/some/conf/commands.json').returns(JSON.stringify(this.commands));
    this.stub(process, 'argv', ['arg1', 'arg2']);
    bag.command(this.base);
  },
  'should set global options when specified': function () {
    this.mockCommander.expects('version').once().withExactArgs('1.2.3');
    this.mockCommander.expects('parse').once().withExactArgs(['arg1', 'arg2']);
    // add global options
    this.commands.options = [{ arg: '-g, --global', desc: 'Global description', action: function () {} }];
    this.mockFs.expects('readFileSync').once().withExactArgs('/some/conf/commands.json').returns(JSON.stringify(this.commands));
    this.stub(process, 'argv', ['arg1', 'arg2']);
    bag.command(this.base);
  }
});

buster.testCase('cli - _preCommand', {
  setUp: function () {
    this.mockCommander = this.mock(commander);
    this.mockConsole = this.mock(console);
  },
  'should not log anything when commands have empty examples array': function () {
    this.mockCommander.expects('on').once().withArgs('--help').callsArgWith(1);

    var commands = {
      somecommand1: { examples: [] },
      somecommand2: { examples: [] }
    };
    bag._preCommand(commands);
  },
  'should not log anything when commands do not have any examples fields': function () {
    this.mockCommander.expects('on').once().withArgs('--help').callsArgWith(1);

    var commands = {
      somecommand1: {},
      somecommand2: {}
    };
    bag._preCommand(commands);
  },
  'should log examples when configured in commands': function () {
    this.mockConsole.expects('log').once().withExactArgs('  Examples:\n');
    this.mockConsole.expects('log').once().withExactArgs('    %s:', 'somecommand1');
    this.mockConsole.expects('log').once().withExactArgs('      %s', 'example1');
    this.mockConsole.expects('log').once().withExactArgs('      %s', 'example2');
    this.mockConsole.expects('log').once().withExactArgs('    %s:', 'somecommand2');
    this.mockConsole.expects('log').once().withExactArgs('      %s', 'example3');
    this.mockCommander.expects('on').once().withArgs('--help').callsArgWith(1);

    var commands = {
      somecommand1: { examples: ['example1', 'example2'] },
      somecommand1a: {},
      somecommand2: { examples: ['example3'] },
      somecommand2b: { examples: [] }
    };
    bag._preCommand(commands);
  }
});

buster.testCase('cli - _postCommand', {
  setUp: function () {
    this.mockCommander = this.mock(commander);
    this.mockConsole = this.mock(console);
    this.mockProcess = this.mock(process);
  },
  'should return without error when args is empty': function (done) {
    var err, result;
    try {
      result = bag._postCommand();
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should return without error when commands config is not set up with any args': function (done) {
    var args = [{ _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: {} },
      err, result;
    try {
      result = bag._postCommand(args, commandsConfig);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should return without error when command line includes opt flag (commander.args is empty for some reason)': function (done) {
    process.argv = ['node', 'somecommand', '--someopt'];
    var err, result;
    try {
      result = bag._postCommand([]);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should log usage message and exit when commands config has args but the command does not provide any argument': function () {
    this.mockConsole.expects('error').once().withExactArgs('Usage: someparentcommand somecommand <arg1> <arg2>'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = [{ _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { args: [{ name: 'arg1', rules: [ 'number' ]}, { name: 'arg2', rules: [ 'number' ] }] } },
      result = bag._postCommand(args, commandsConfig);
    refute.defined(result);
  },
  'should log usage message when there is a mix of mandatory and optional args': function () {
    this.mockConsole.expects('error').once().withExactArgs('Usage: someparentcommand somecommand <arg1> <arg2> [arg3]'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = [{ _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { args: [{ name: 'arg1', rules: [ 'number' ]}, { name: 'arg2', rules: [ 'number' ]}, { name: 'arg3', optional: true }] } },
      result = bag._postCommand(args, commandsConfig);
    refute.defined(result);
  },
  'should log usage message when there are multiple optional args': function () {
    this.mockConsole.expects('error').once().withExactArgs('Usage: someparentcommand somecommand <arg1> [arg2] [arg3]'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = [{ _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { args: [{ name: 'arg1', rules: [ 'number' ]}, { name: 'arg2', optional: true}, { name: 'arg3', optional: true }] } },
      result = bag._postCommand(args, commandsConfig);
    refute.defined(result);
  },
  'should log error message when there is an invalid argument': function () {
    this.mockConsole.expects('error').once().withExactArgs('Invalid argument: <arg1> must be number'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = ['foobar', { _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { args: [{ name: 'arg1', rules: [ 'number' ] }] } },
      result = bag._postCommand(args, commandsConfig);
    refute.defined(result);
  },
  'should log error message when empty string is passed on required rule': function () {
    this.mockConsole.expects('error').once().withExactArgs('Invalid argument: <arg1> must be required'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = ['', { _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { args: [{ name: 'arg1', rules: [ 'required' ] }] } },
      result = bag._postCommand(args, commandsConfig);
    refute.defined(result);
  },
  'should log error message when non-email string is passed on email rule': function () {
    this.mockConsole.expects('error').once().withExactArgs('Invalid argument: <arg1> must be email'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = ['foobar', { _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { args: [{ name: 'arg1', rules: [ 'email' ] }] } },
      result = bag._postCommand(args, commandsConfig);
    refute.defined(result);
  },
  'should log error message when rule does not exist': function () {
    this.mockConsole.expects('error').once().withExactArgs('Invalid argument rule: someRuleThatCantPossiblyExist'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = ['foobar', { _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { args: [{ name: 'arg1', rules: [ 'someRuleThatCantPossiblyExist' ] }] } },
      result = bag._postCommand(args, commandsConfig);
    refute.defined(result);
  },
  'should return without error when command has valid argument as configured in commands setup file': function (done) {
    var args = ['123', { _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { args: [{ name: 'arg1', rules: [ 'number' ] }, { name: 'arg2', optional: true }] } },
      err, result;
    try {
      result = bag._postCommand(args, commandsConfig);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should call commander help when arguments is empty': function (done) {
    process.argv = ['node', 'somecommand'];
    this.mockCommander.expects('help').once().withExactArgs();
    var err, result;
    try {
      result = bag._postCommand([]);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should log error message and exit when command is unknown': function () {
    this.mockConsole.expects('error').once().withExactArgs('Unknown command: blah, use --help for more info'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = ['blah'],
      commandsConfig = { somecommand: { args: [{ name: 'arg1', rules: [ 'number' ]}, { name: 'arg2', rules: [ 'number' ] }] } },
      result = bag._postCommand(args, commandsConfig);
    refute.defined(result);
  },
  'should log error message when command has invalid command option': function (done) {
    this.mockConsole.expects('error').once().withExactArgs('Invalid option: <-s, --some-arg <someArg>> must be number'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = ['123', { _name: 'somecommand', someArg: 'abcdef', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { options: [{
        arg: '-s, --some-arg <someArg>',
        rules: [ 'number' ]
      }]}},
      err, result;
    try {
      result = bag._postCommand(args, commandsConfig);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should return without error when there is no invalid command option': function (done) {
    var args = ['123', { _name: 'somecommand', someArg: '12345', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { options: [{
        arg: '-s, --some-arg <someArg>',
        rules: [ 'number' ]
      }]}},
      err, result;
    try {
      result = bag._postCommand(args, commandsConfig);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should return without error when command option does not have any validation rule': function (done) {
    var args = ['123', { _name: 'somecommand', someArg: 'abcdef', parent: { _name: 'someparentcommand' } }],
      commandsConfig = { somecommand: { options: [{
        arg: '-s, --some-arg <someArg>'
      }]}},
      err, result;
    try {
      result = bag._postCommand(args, commandsConfig);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should log error message when command has invalid global option': function (done) {
    this.mockConsole.expects('error').once().withExactArgs('Invalid option: <-s, --some-arg <someArg>> must be number'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = ['123', { _name: 'somecommand', parent: { _name: 'someparentcommand', someArg: 'abcdef' } }],
      commandsConfig = { somecommand: {}},
      globalOptsConfig = [{
        arg: '-s, --some-arg <someArg>',
        rules: [ 'number' ]
      }],
      err, result;
    try {
      result = bag._postCommand(args, commandsConfig, globalOptsConfig);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should return without error when there is no invalid global option': function (done) {
    var args = ['123', { _name: 'somecommand', parent: { _name: 'someparentcommand', someArg: '12345' } }],
      commandsConfig = { somecommand: {}},
      globalOptsConfig = [{
        arg: '-s, --some-arg <someArg>',
        rules: [ 'number' ]
      }],
      err, result;
    try {
      result = bag._postCommand(args, commandsConfig, globalOptsConfig);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  },
  'should return without error when global option does not have any validation rule': function (done) {
    var args = ['123', { _name: 'somecommand', parent: { _name: 'someparentcommand', someArg: 'abcdef' } }],
      commandsConfig = { somecommand: {}},
      globalOptsConfig = [{
        arg: '-s, --some-arg <someArg>'
      }],
      err, result;
    try {
      result = bag._postCommand(args, commandsConfig, globalOptsConfig);
    } catch (e) {
      err = e;
    }
    refute.defined(result);
    done(err);
  }
});

buster.testCase('cli - exec', {
  setUp: function () {
    this.mockProcessStdout = this.mock(process.stdout);
    this.mockProcessStderr = this.mock(process.stderr);
  },
 'should log stdout output and camouflage error to callback when an error occurs and fallthrough is allowed': function (done) {
    this.mockProcessStdout.expects('write').once().withExactArgs('somestdout'.green);
    var mockExec = {
      stdout: { on: function (event, cb) {
        cb('somestdout');
      }},
      stderr: { on: function (event, cb) {} }
    };
    this.stub(childProcess, 'exec', function (command, cb) {
      assert.equals(command, 'somecommand');
      cb(new Error('someerror'));
      return mockExec;
    });
    bag.exec('somecommand', true, function cb(err, result) {
      assert.isNull(err);
      assert.equals(result.message, 'someerror');
      done();
    });
  },
  'should log stderr output and pass error to callback when an error occurs and fallthrough is not allowed': function (done) {
    this.mockProcessStderr.expects('write').once().withExactArgs('somestderr'.red);
    var mockExec = {
      stdout: { on: function (event, cb) {} },
      stderr: { on: function (event, cb) {
        cb('somestderr');
      }}
    };
    this.stub(childProcess, 'exec', function (command, cb) {
      assert.equals(command, 'somecommand');
      cb(new Error('someerror'));
      return mockExec;
    });
    bag.exec('somecommand', false, function cb(err, result) {
      assert.equals(err.message, 'someerror');
      refute.defined(result);
      done();
    });
  }
});

buster.testCase('cli - execAndCollect', {
  setUp: function () {
    this.mockProcessStdout = this.mock(process.stdout);
    this.mockProcessStderr = this.mock(process.stderr);
  },
  'should collect stdout and stderr output': function (done) {
    this.mockProcessStdout.expects('write').never();
    this.mockProcessStderr.expects('write').never();
    var mockExec = {
      stdout: {
        on: function (event, cb) {
          cb('stdout output 1');
          cb('stdout output 2');
        }
      },
      stderr: { on: function (event, cb) {
        cb('stderr output 1');
        cb('stderr output 2');
      }}
    };
    this.stub(childProcess, 'exec', function (command, cb) {
      assert.equals(command, 'somecommand');

      // give bagofcli#execute time to set up stdout.on and stderr.on handlers, check assertions after
      // next tick.
      async.setImmediate(function() {
        cb(null);
      });
      return mockExec;
    });
    bag.execAndCollect('somecommand', false, function cb(err, stdOut, stdErr, result) {
      assert.isNull(err);
      assert.equals(stdOut, 'stdout output 1stdout output 2');
      assert.equals(stdErr, 'stderr output 1stderr output 2');
      refute.defined(result);
      done();
    });
  },
  'should collect stdout and stderr output and camouflage error to callback when an error occurs and fallthrough is allowed': function (done) {
    this.mockProcessStdout.expects('write').never();
    this.mockProcessStderr.expects('write').never();
    var mockExec = {
      stdout: { on: function (event, cb) {
        cb('stdout output 1');
        cb('stdout output 2');
      }},
      stderr: { on: function (event, cb) {
        cb('stderr output 1');
        cb('stderr output 2');
      }}
    };
    this.stub(childProcess, 'exec', function (command, cb) {
      assert.equals(command, 'somecommand');

      // give bagofcli#execute time to set up stdout.on and stderr.on handlers, check assertions after
      // next tick.
      async.setImmediate(function() {
        cb(new Error('someerror'));
      });
      return mockExec;
    });
    bag.execAndCollect('somecommand', true, function cb(err, stdOut, stdErr, result) {
      assert.isNull(err);
      assert.equals(stdOut, 'stdout output 1stdout output 2');
      assert.equals(stdErr, 'stderr output 1stderr output 2');
      assert.equals(result.message, 'someerror');
      done();
    });
  },
  'should collect stdout and stderr output and pass error to callback when an error occurs and fallthrough is not allowed': function (done) {
    this.mockProcessStdout.expects('write').never();
    this.mockProcessStderr.expects('write').never();
    var mockExec = {
      stdout: { on: function (event, cb) {
        cb('stdout output 1');
        cb('stdout output 2');
      }},
      stderr: { on: function (event, cb) {
        cb('stderr output 1');
        cb('stderr output 2');
      }}
    };
    this.stub(childProcess, 'exec', function (command, cb) {
      assert.equals(command, 'somecommand');
      // give bagofcli#execute time to set up stdout.on and stderr.on handlers, check assertions after
      // next tick.
      async.setImmediate(function() {
        cb(new Error('someerror'));
      });
      return mockExec;
    });
    bag.execAndCollect('somecommand', false, function cb(err, stdOut, stdErr, result) {
      assert.equals(err.message, 'someerror');
      assert.equals(stdOut, 'stdout output 1stdout output 2');
      assert.equals(stdErr, 'stderr output 1stderr output 2');
      refute.defined(result);
      done();
    });
  }
});

buster.testCase('cli - exit', {
  setUp: function () {
    this.mockConsole = this.mock(console);
    this.mockProcess = this.mock(process);
  },
  'should exit with status code 0 when error does not exist': function () {
    this.mockProcess.expects('exit').once().withExactArgs(0);
    bag.exit();
  },
  'should exit with status code 1 and logs the error message when error exists': function () {
    this.mockConsole.expects('error').once().withExactArgs('someerror'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    bag.exit(new Error('someerror'));
  },
  'should log the stringified object when error is a non-Error object': function () {
    this.mockConsole.expects('error').once().withExactArgs('{"error":"someerror"}'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    bag.exit({ error: 'someerror'});
  },
  'should log the stringified when error is an array': function () {
    this.mockConsole.expects('error').once().withExactArgs('["some error 1","some error 2"]'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    bag.exit(['some error 1', 'some error 2']);
  }
});

buster.testCase('cli - exitCb', {
  setUp: function () {
    this.mockConsole = this.mock(console);
    this.mockProcess = this.mock(process);
  },
  'should exit with status code 0 and logs the result when error does not exist and no success callback is specified': function () {
    this.mockConsole.expects('log').once().withExactArgs('some success'.green);
    this.mockProcess.expects('exit').once().withExactArgs(0);
    bag.exitCb()(null, 'some success');
  },
  'should exit with status code 1 and logs the error message when error exists and no error callback is specified': function () {
    this.mockConsole.expects('error').once().withExactArgs('some error'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    bag.exitCb()(new Error('some error'));
  },
  'should exit with status code 1 and logs stringified object when error is non-Error object': function () {
    this.mockConsole.expects('error').once().withExactArgs('{"error":"some error"}'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    bag.exitCb()({ error: 'some error'});
  },
  'should exit with status code 0 and call success callback when error does not exist and success callback is specified': function (done) {
    this.mockProcess.expects('exit').once().withExactArgs(0);
    bag.exitCb(null, function (result) {
      assert.equals(result, 'some success');
      done();
    })(null, 'some success');
  },
  'should exit with status code 1 and call error callback when error exists and error callback is specified': function (done) {
    this.mockProcess.expects('exit').once().withExactArgs(1);
    bag.exitCb(function (err) {
      assert.equals(err.message, 'some error');
      done();
    })(new Error('some error'));
  },
  'should pass stringified error when error is non-Error object': function (done) {
    this.mockProcess.expects('exit').once().withExactArgs(1);
    bag.exitCb(function (err) {
      assert.equals(err, { error: 'someerror'});
      done();
    })({ error: 'someerror'});
  }
});

buster.testCase('cli - files', {
  setUp: function () {
    this.mockFs = this.mock(fs);
    this.mockWrench = this.mock(wrench);
    this.trueFn = function () { return true; };
    this.falseFn = function () { return false; };
  },
  'should return files as-is when all items are files': function () {
    this.mockFs.expects('statSync').withExactArgs('file1').returns({ isFile: this.trueFn });
    this.mockFs.expects('statSync').withExactArgs('file2').returns({ isFile: this.trueFn });
    var files = bag.files(['file1', 'file2']);
    assert.equals(files, ['file1', 'file2']);
  },
  'should return files under a directory': function () {
    this.mockWrench.expects('readdirSyncRecursive').withExactArgs('dir1').returns(['file1', 'file2']);
    this.mockFs.expects('statSync').withExactArgs('dir1').returns({ isFile: this.falseFn, isDirectory: this.trueFn });
    this.mockFs.expects('statSync').withExactArgs('dir1/file1').returns({ isFile: this.trueFn });
    this.mockFs.expects('statSync').withExactArgs('dir1/file2').returns({ isFile: this.trueFn });
    var files = bag.files(['dir1']);
    assert.equals(files, ['dir1/file1', 'dir1/file2']);
  },
  'should only return matching files when match opt is specified': function () {
    this.mockWrench.expects('readdirSyncRecursive').withExactArgs('dir1').returns(['file1', 'file2']);
    this.mockFs.expects('statSync').withExactArgs('dir1').returns({ isFile: this.falseFn, isDirectory: this.trueFn });
    this.mockFs.expects('statSync').withExactArgs('dir1/file1').returns({ isFile: this.trueFn });
    this.mockFs.expects('statSync').withExactArgs('dir1/file2').returns({ isFile: this.trueFn });
    this.mockFs.expects('statSync').withExactArgs('file2').returns({ isFile: this.trueFn });
    var files = bag.files(['dir1', 'file2'], { match: '2$' });
    assert.equals(files, ['dir1/file2', 'file2']);
  },
  'should return nothing when no match is found': function () {
    this.mockWrench.expects('readdirSyncRecursive').withExactArgs('dir1').returns(['file1']);
    this.mockFs.expects('statSync').withExactArgs('dir1').returns({ isFile: this.falseFn, isDirectory: this.trueFn });
    this.mockFs.expects('statSync').withExactArgs('dir1/file1').returns({ isFile: this.trueFn });
    this.mockFs.expects('statSync').withExactArgs('file1').returns({ isFile: this.trueFn });
    var files = bag.files(['dir1', 'file1'], { match: '2$' });
    assert.equals(files, []);
  },
  'should return nothing when directory contains non-directory and non-file': function () {
    this.mockWrench.expects('readdirSyncRecursive').withExactArgs('dir1').returns(['item1']);
    this.mockFs.expects('statSync').withExactArgs('dir1').returns({ isFile: this.falseFn, isDirectory: this.trueFn });
    this.mockFs.expects('statSync').withExactArgs('dir1/item1').returns({ isFile: this.falseFn, isDirectory: this.falseFn });
    var files = bag.files(['dir1']);
    assert.equals(files, []);
  },
  'should return nothing when items are non-directory and non-file': function () {
    this.mockFs.expects('statSync').withExactArgs('item1').returns({ isFile: this.falseFn, isDirectory: this.falseFn });
    var files = bag.files(['item1']);
    assert.equals(files, []);
  }
});

buster.testCase('cli - lookupConfig', {
  setUp: function () {
    this.mockPrompt = this.mock(prompt);
  },
  'should pass value when single configuration key exists as environment variable': function (done) {
    this.stub(process, 'env', { somekey: 'somevalue' });
    bag.lookupConfig('somekey', {}, function (err, result) {
      assert.equals(err, null);
      assert.equals(result.somekey, 'somevalue');
      done();
    });
  },
  'should pass values when multiple configuration keys exists as environment variables': function (done) {
    this.stub(process, 'env', { somekey: 'somevalue', anotherkey: 'anothervalue' });
    bag.lookupConfig(['somekey', 'anotherkey'], {}, function (err, result) {
      assert.equals(err, null);
      assert.equals(result.somekey, 'somevalue');
      assert.equals(result.anotherkey, 'anothervalue');
      done();
    });
  },
  'should pass undefined when configuration key does not exist at all': function (done) {
    this.stub(process, 'env', { somekey: 'somevalue', anotherkey: 'anothervalue' });
    bag.lookupConfig(['mykey'], {}, function (err, result) {
      assert.equals(err, null);
      refute.defined(result.mykey);
      done();
    });
  },
  'should pass values when multiple configuration keys exists in a json file': function (done) {
    this.stub(process, 'env', {});
    this.stub(bag, 'lookupFile', function (file) {
      return '{ "somekey": "somevalue", "anotherkey": "anothervalue" }';
    });
    bag.lookupConfig(['somekey', 'anotherkey'], { file: 'someconffile.json' }, function (err, result) {
      assert.equals(err, null);
      assert.equals(result.somekey, 'somevalue');
      assert.equals(result.anotherkey, 'anothervalue');
      done();
    });
  },
  'should pass undefined when configuration key does not exist in a json file': function (done) {
    this.stub(process, 'env', {});
    this.stub(bag, 'lookupFile', function (file) {
      return '{}';
    });
    bag.lookupConfig(['somekey', 'anotherkey'], { file: 'someconffile.json' }, function (err, result) {
      assert.equals(err, null);
      refute.defined(result.somekey);
      refute.defined(result.anotherkey);
      done();
    });
  },
  'should pass values when multiple configuration keys exists in a yaml file': function (done) {
    this.stub(process, 'env', {});
    this.stub(bag, 'lookupFile', function (file) {
      return '---\nsomekey: somevalue\nanotherkey: anothervalue';
    });
    bag.lookupConfig(['somekey', 'anotherkey'], { file: 'someconffile.yaml' }, function (err, result) {
      assert.equals(err, null);
      assert.equals(result.somekey, 'somevalue');
      assert.equals(result.anotherkey, 'anothervalue');
      done();
    });
  },
  'should pass undefined when configuration key does not exist in a yaml file': function (done) {
    this.stub(process, 'env', {});
    this.stub(bag, 'lookupFile', function (file) {
      return '';
    });
    bag.lookupConfig(['somekey', 'anotherkey'], { file: 'someconffile.yaml' }, function (err, result) {
      assert.equals(err, null);
      refute.defined(result.somekey);
      refute.defined(result.anotherkey);
      done();
    });
  },
  'should throw error when configuration file extension is unsupported': function (done) {
    this.stub(process, 'env', {});
    this.stub(bag, 'lookupFile', function (file) {
      return '';
    });
    try {
      bag.lookupConfig(['somekey', 'anotherkey'], { file: 'someconffile.txt' }, function (err, result) {
      });
    } catch (e) {
      assert.equals(e.message, 'Configuration file extension is not supported');
      done();
    }
  },
  'should prompt for values when configuration file does not exist as environment variables and in configuration file': function (done) {
    this.stub(process, 'env', {});
    this.stub(bag, 'lookupFile', function (file) {
      return '';
    });
    this.mockPrompt.expects('get').once().withArgs([{ name: 'somepasswordkey', hidden: true }, 'anotherkey']).callsArgWith(1, null, { somepasswordkey: 'somevalue', anotherkey: 'anothervalue' });
    bag.lookupConfig(['somepasswordkey', 'anotherkey'], { file: 'someconffile.yaml', prompt: true }, function (err, result) {
      assert.equals(err, null);
      assert.equals(result.somepasswordkey, 'somevalue');
      assert.equals(result.anotherkey, 'anothervalue');
      done();
    });
  },
  'should retrieve values from various sources': function (done) {
    this.stub(process, 'env', { somekey: 'somevalue' });
    this.stub(bag, 'lookupFile', function (file) {
      return 'anotherkey: anothervalue';
    });
    this.mockPrompt.expects('get').once().withArgs([{ name: 'somepasswordkey', hidden: true }, 'inexistingkey']).callsArgWith(1, null, { somepasswordkey: 'somepasswordvalue', inexistingkey: undefined });
    bag.lookupConfig(['somekey', 'anotherkey', 'somepasswordkey', 'inexistingkey'], { file: 'someconffile.yaml', prompt: true }, function (err, result) {
      assert.equals(err, null);
      assert.equals(result.somekey, 'somevalue');
      assert.equals(result.somepasswordkey, 'somepasswordvalue');
      assert.equals(result.anotherkey, 'anothervalue');
      refute.defined(result.inexistingkey);
      done();
    });
  },
  'should return undefined when keys do not exist': function (done) {
    this.stub(process, 'env', { somekey: 'somevalue' });
    this.stub(bag, 'lookupFile', function (file) {
      return 'anotherkey: anothervalue';
    });
    bag.lookupConfig([], { file: 'someconffile.yaml', prompt: true }, function (err, result) {
      assert.equals(err, null);
      assert.equals(result, {});
      done();
    });
  }
});

buster.testCase('cli - lookupFile', {
  setUp: function () {
    this.mockProcess = this.mock(process);
    this.mockFs = this.mock(fs);
  },
  'should return file content in current directory when it exists': function () {
    this.mockProcess.expects('cwd').once().returns('/curr/dir');
    this.mockFs.expects('readFileSync').once().withExactArgs('/curr/dir/.conf.json').returns('currdirfilecontent');
    var data = bag.lookupFile('.conf.json');
    assert.equals(data, 'currdirfilecontent');
  },
  'should return file content in home directory when it exists but none exists in current directory and platform is windows': function () {
    this.mockProcess.expects('cwd').once().returns('/curr/dir');
    this.stub(process, 'env', { USERPROFILE: '/home/dir' });
    this.mockFs.expects('readFileSync').once().withExactArgs('/curr/dir/.conf.json').throws(new Error('doesnotexist'));
    this.mockFs.expects('readFileSync').once().withExactArgs('/home/dir/.conf.json').returns('homedirfilecontent');
    var data = bag.lookupFile('.conf.json', { platform: 'win32' });
    assert.equals(data, 'homedirfilecontent');
  },
  'should return file content in home directory when it exists but none exists in current directory and platform is non windows': function () {
    this.mockProcess.expects('cwd').once().returns('/curr/dir');
    this.stub(process, 'env', { HOME: '/home/dir' });
    this.mockFs.expects('readFileSync').once().withExactArgs('/curr/dir/.conf.json').throws(new Error('doesnotexist'));
    this.mockFs.expects('readFileSync').once().withExactArgs('/home/dir/.conf.json').returns('homedirfilecontent');
    var data = bag.lookupFile('.conf.json', { platform: 'linux' });
    assert.equals(data, 'homedirfilecontent');
  },
  'should throw an error when configuration file does not exist anywhere and file has relative path': function (done) {
    this.mockProcess.expects('cwd').once().returns('/curr/dir');
    this.stub(process, 'env', { HOME: '/home/dir' });
    this.mockFs.expects('readFileSync').once().withExactArgs('/curr/dir/.conf.json').throws(new Error('doesnotexist'));
    this.mockFs.expects('readFileSync').once().withExactArgs('/home/dir/.conf.json').throws(new Error('doesnotexist'));
    try {
      bag.lookupFile('.conf.json', { platform: 'linux' });
    } catch (err) {
      assert.equals(err.message, 'Unable to lookup file in /curr/dir/.conf.json, /home/dir/.conf.json');
      done();
    }
  },
  'should return file content with absolute path when it exists': function () {
    this.mockFs.expects('readFileSync').once().withExactArgs('/absolute/dir/.conf.json').returns('absolutedirfilecontent');
    var data = bag.lookupFile('/absolute/dir/.conf.json');
    assert.equals(data, 'absolutedirfilecontent');
  },
  'should throw an error when configuration file does not exist anywhere and file has absolute path': function (done) {
    this.stub(process, 'env', { HOME: '/home/dir' });
    this.mockFs.expects('readFileSync').once().withExactArgs('/absolute/dir/.conf.json').throws(new Error('doesnotexist'));
    this.mockFs.expects('readFileSync').once().withExactArgs('/home/dir/.conf.json').throws(new Error('doesnotexist'));
    try {
      bag.lookupFile('/absolute/dir/.conf.json', { platform: 'linux' });
    } catch (err) {
      assert.equals(err.message, 'Unable to lookup file in /absolute/dir/.conf.json, /home/dir/.conf.json');
      done();
    }
  }
});

buster.testCase('cli - spawn', {
  setUp: function () {
    this.mockChildProcess = this.mock(childProcess);
    this.mockProcessStdout = this.mock(process.stdout);
    this.mockProcessStderr = this.mock(process.stderr);
  },
  'should write data via stdout and stderr when data event is emitted': function () {
    this.mockProcessStdout.expects('write').once().withExactArgs('somestdoutdata'.green);
    this.mockProcessStderr.expects('write').once().withExactArgs('somestderrdata'.red);
    var mockSpawn = {
      stdout: {
        on: function (event, cb) {
          assert.equals(event, 'data');
          cb('somestdoutdata');
        }
      },
      stderr: {
        on: function (event, cb) {
          assert.equals(event, 'data');
          cb('somestderrdata');
        }
      },
      on: function (event, cb) {}
    };
    this.mockChildProcess.expects('spawn').withExactArgs('somecommand', ['arg1', 'arg2']).returns(mockSpawn);
    bag.spawn('somecommand', ['arg1', 'arg2']);
  },
  'should pass error and exit code to callback when exit code is not 0': function (done) {
    var mockSpawn = {
      stdout: { on: function (event, cb) {}},
      stderr: { on: function (event, cb) {}},
      on: function (event, cb) {
        assert.equals(event, 'exit');
        cb(1);
      }
    };
    this.mockChildProcess.expects('spawn').withExactArgs('somecommand', ['arg1', 'arg2']).returns(mockSpawn);
    bag.spawn('somecommand', ['arg1', 'arg2'], function (err, result) {
      assert.equals(err.message, '1');
      assert.equals(result, 1);
      done();
    });
  },
  'should pass no error and exit code to callback when exit code is 0': function (done) {
    var mockSpawn = {
      stdout: { on: function (event, cb) {}},
      stderr: { on: function (event, cb) {}},
      on: function (event, cb) {
        assert.equals(event, 'exit');
        cb(0);
      }
    };
    this.mockChildProcess.expects('spawn').withExactArgs('somecommand', ['arg1', 'arg2']).returns(mockSpawn);
    bag.spawn('somecommand', ['arg1', 'arg2'], function (err, result) {
      refute.defined(err);
      assert.equals(result, 0);
      done();
    });
  }
});
