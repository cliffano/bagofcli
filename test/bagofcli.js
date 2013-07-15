var buster = require('buster'),
  bag = require('../lib/bagofcli'),
  childProcess = require('child_process'),
  colors = require('colors'),
  commander = require('commander'),
  fs = require('fs');

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
    assert.equals(result, undefined);
    done(err);
  },
  'should return without error when commands config is not set up with any args': function (done) {
    var args = [{ _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commands = { somecommand: {} },
      err, result;
    try {
      result = bag._postCommand(args, commands);
    } catch (e) {
      err = e;
    }
    assert.equals(result, undefined);
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
    assert.equals(result, undefined);
    done(err);
  },
  'should log usage message and exit when commands config has args but the command does not provide any argument': function () {
    this.mockConsole.expects('error').once().withExactArgs('Usage: someparentcommand somecommand <arg1> <arg2>'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = [{ _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commands = { somecommand: { args: [{ name: 'arg1', rules: [ 'isNumeric' ]}, { name: 'arg2', rules: [ 'isNumeric' ] }] } },
      result = bag._postCommand(args, commands);
    assert.equals(result, undefined);
  },
  'should log usage message when there is a mix of mandatory and optional args': function () {
    this.mockConsole.expects('error').once().withExactArgs('Usage: someparentcommand somecommand <arg1> <arg2> [arg3]'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = [{ _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commands = { somecommand: { args: [{ name: 'arg1', rules: [ 'isNumeric' ]}, { name: 'arg2', rules: [ 'isNumeric' ]}, { name: 'arg3', optional: true }] } },
      result = bag._postCommand(args, commands);
    assert.equals(result, undefined);
  },
  'should log usage message when there are multiple optional args': function () {
    this.mockConsole.expects('error').once().withExactArgs('Usage: someparentcommand somecommand <arg1> [arg2] [arg3]'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = [{ _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commands = { somecommand: { args: [{ name: 'arg1', rules: [ 'isNumeric' ]}, { name: 'arg2', optional: true}, { name: 'arg3', optional: true }] } },
      result = bag._postCommand(args, commands);
    assert.equals(result, undefined);
  },
  'should log error message when there is an invalid argument': function () {
    this.mockConsole.expects('error').once().withExactArgs('Invalid argument: <arg1> must be isNumeric'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = ['foobar', { _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commands = { somecommand: { args: [{ name: 'arg1', rules: [ 'isNumeric' ] }] } },
      result = bag._postCommand(args, commands);
    assert.equals(result, undefined);
  },
  'should return without error when command has valid argument as configured in commands setup file': function (done) {
    var args = ['123', { _name: 'somecommand', parent: { _name: 'someparentcommand' } }],
      commands = { somecommand: { args: [{ name: 'arg1', rules: [ 'isNumeric' ] }, { name: 'arg2', optional: true }] } },
      err, result;
    try {
      result = bag._postCommand(args, commands);
    } catch (e) {
      err = e;
    }
    assert.equals(result, undefined);
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
    assert.equals(result, undefined);
    done(err);
  },
  'should log error message and exit when command is unknown': function () {
    this.mockConsole.expects('error').once().withExactArgs('Unknown command: blah, use --help for more info'.red);
    this.mockProcess.expects('exit').once().withExactArgs(1);
    var args = ['blah'],
      commands = { somecommand: { args: [{ name: 'arg1', rules: [ 'isNumeric' ]}, { name: 'arg2', rules: [ 'isNumeric' ] }] } },
      result = bag._postCommand(args, commands);
    assert.equals(result, undefined);
  }
});

buster.testCase('cli - exec', {
  setUp: function () {
    this.mockProcessStdout = this.mock(process.stdout);
    this.mockProcessStderr = this.mock(process.stderr);
  },
 'should log stdout output and camouflage error to callback when an error occurs and fallthrough is allowed': function (done) {
    this.mockProcessStdout.expects('write').once().withExactArgs('somestdout'.green);
    this.mockProcessStdout.expects('write').once().withArgs();
    var mockExec = {
      stdout: { on: function (event, cb) {
        cb('somestdout');
      }},
      stderr: { on: function (event, cb) {} }
    };
    this.stub(childProcess, 'exec', function (command, cb) {
      assert.equals(command, 'somecommand');
      cb(new Error('someerror'), null, 'somestderr');
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
      cb(new Error('someerror'), null, 'somestderr');
      return mockExec;
    });
    bag.exec('somecommand', false, function cb(err, result) {
      assert.equals(err.message, 'someerror');
      assert.equals(result, undefined);
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
    this.stub(process, 'platform', 'win32');
    this.mockFs.expects('readFileSync').once().withExactArgs('/curr/dir/.conf.json').throws(new Error('doesnotexist')); 
    this.mockFs.expects('readFileSync').once().withExactArgs('/home/dir/.conf.json').returns('homedirfilecontent'); 
    var data = bag.lookupFile('.conf.json');
    assert.equals(data, 'homedirfilecontent');
  },
  'should return file content in home directory when it exists but none exists in current directory and platform is non windows': function () {
    this.mockProcess.expects('cwd').once().returns('/curr/dir');
    this.stub(process, 'env', { HOME: '/home/dir' });
    this.stub(process, 'platform', 'linux');
    this.mockFs.expects('readFileSync').once().withExactArgs('/curr/dir/.conf.json').throws(new Error('doesnotexist')); 
    this.mockFs.expects('readFileSync').once().withExactArgs('/home/dir/.conf.json').returns('homedirfilecontent'); 
    var data = bag.lookupFile('.conf.json');
    assert.equals(data, 'homedirfilecontent');
  },
  'should throw an error when configuration file does not exist anywhere and file has relative path': function (done) {
    this.mockProcess.expects('cwd').once().returns('/curr/dir');
    this.stub(process, 'env', { HOME: '/home/dir' });
    this.stub(process, 'platform', 'linux');
    this.mockFs.expects('readFileSync').once().withExactArgs('/curr/dir/.conf.json').throws(new Error('doesnotexist'));
    this.mockFs.expects('readFileSync').once().withExactArgs('/home/dir/.conf.json').throws(new Error('doesnotexist'));
    try {
      bag.lookupFile('.conf.json');
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
    this.stub(process, 'platform', 'linux');
    this.mockFs.expects('readFileSync').once().withExactArgs('/absolute/dir/.conf.json').throws(new Error('doesnotexist'));
    this.mockFs.expects('readFileSync').once().withExactArgs('/home/dir/.conf.json').throws(new Error('doesnotexist'));
    try {
      bag.lookupFile('/absolute/dir/.conf.json');
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
      assert.equals(err.message, 1);
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
      assert.equals(err, undefined);
      assert.equals(result, 0);
      done();
    });
  }
});