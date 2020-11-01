"use strict"
import _ from 'lodash';
import async from 'async';
import child from 'child_process';
import colors from 'colors';
import commander from 'commander';
import fs from 'fs';
import iz from 'iz';
import p from 'path';
import inquirer from 'inquirer';
import util from 'util';
import validators from 'iz/lib/validators.js';
import wrench from 'wrench-sui';  
import yaml from 'yaml-js';

/**
 * Parse command line arguments and execute actions based on the specified commands.
 * Uses commander.js to provide -V / --version to display version number,
 * and -h / --help to display help info.
 *
 * @param {String} base: base directory where the client module is located,
 *   used as a base directory to read command file and package.json file,
 *   ideally the value would be the client's __dirname
 * @param {Object} actions: action function for each command in format: { command: { action: function () {} }},
 *   the command name in actions object is then mapped to the command name specified in commandFile
 * @param {Object} opts: optional
 *   - commandFile: relative path to command file from base directory, defaults to 'conf/commands.json'
 */
function command(base, actions, opts) {

  actions = actions || {};
  opts = opts || {};

  const commands = JSON.parse(fs.readFileSync(p.join(base, opts.commandFile || '../conf/commands.json'))),
    pkg = JSON.parse(fs.readFileSync(p.join(base, '../package.json')));

  if (actions.commands && commands.commands) {
    _.each(actions.commands, function (command, name) {
      if (commands.commands[name]) {
        commands.commands[name].action = command.action;
      }
    });
  }

  commander.version(pkg.version);

  if (commands.options) {
    _.each(commands.options, function (option) {
      commander.option(option.arg, option.desc, option.action);
    });
  }

  _.each(commands.commands, function (command, name) {
    const program = commander
      .command(name)
      .description(command.desc);

    _.each(command.options, function (option) {
      program.option(option.arg, option.desc, option.action);
    });

    program.action(command.action);
  });

  _preCommand(commands.commands);

  commander.parse(process.argv);

  // NOTE: commander.args is populated by commander#parse,
  // hence _postCommand relies on commander#parse finishing without exiting or throwing error,
  // otherwise _postCommand won't be executed
  _postCommand(commander, commands.commands, commands.options);
}

// Pre-command tasks:
// - if --help flag is specified, append examples after standard help output
function _preCommand(commands) {
  commander.on('--help', function () {

    let hasExample = _.map(_.values(commands), 'examples')
      .filter((elem) => {
        return elem !== undefined;
      });
    if (hasExample.length > 0) {
      hasExample = hasExample.reduce((a, b) => {
        return a.concat(b);
      });
    }
    hasExample = hasExample.length > 0;

    if (hasExample) {

      console.log('  Examples:\n');

      Object.keys(commands).forEach((command) => {
        if (!_.isEmpty(commands[command].examples)) {
          console.log('    %s:', command);
          commands[command].examples.forEach((example) => {
            console.log('      %s', example);
          });
        }
      });
    }
  });
}


// Post-command tasks:
// - if there's no command, display help then exit
// - if command is unknown, display error message then exit
// - if there's command, validate arguments and options then exit
function _postCommand(commanderArg, commandsConfig, globalOptsConfig) {

  const commanderArgs = commanderArg.args;

  // add custom validator required which checks if value is not empty
  validators.required = function(value) {
    return !validators.empty(value);
  };

  function _validate(value, name, desc) {
    return function (rule) {
      iz({ value: value, validators: validators });
      if (Object.keys(validators).indexOf(rule) !== -1) {
        const isValid = validators[rule](value);
        if (isValid === null || isValid === false) {
          exit(new Error(util.format('Invalid %s: <%s> must be %s', desc, name, rule)));
        }
      } else {
        exit(new Error(util.format('Invalid %s rule: %s', desc, rule)));
      }
    };
  }

  if (!commanderArgs) {
    return;

  // } else if (commanderArgs.length === 1) {
  //   // having a single arg
  //   // which means that the command is executed without args, hence display help menu
  //   // NOTE: this check is needed because for some reason commander.args
  //   // also returns empty array when one of the args is an opt (-- prefixed)
  //   if (process.argv.length === 2) {
  //     commander.help();
  //   }

  } else {
    const commandName = commanderArgs[0],
      commandArgs = commanderArgs.slice(1, commanderArgs.length),
      commandConfigArgs = (commandsConfig[commandName]) ? commandsConfig[commandName].args : undefined,
      commandConfigArgsMandatory = _.filter(commandConfigArgs, function(arg) { return !arg.optional; }),
      commandConfigOpts = (commandsConfig[commandName]) ? commandsConfig[commandName].options : undefined;

    // Unknown command error if the command name doesn't exist in the commands configuration
    if (Object.keys(commandsConfig).indexOf(commandName) === -1) {
      exit(new Error(util.format('Unknown command: %s, use --help for more info', commandName)));

    } else if (commandConfigArgs && commandConfigArgs.length > 0) {
      const programName = commanderArg._name;

      // display usage info when mandatory arguments don't exist
      // due to arguments being positional, then comparing the lengths is good enough
      if (commandConfigArgsMandatory.length !== commandArgs.length) {
        exit(new Error(util.format('Usage: %s %s %s', programName, commandName, commandConfigArgs.map((arg) => {
          return util.format((arg.optional) ? '[%s]' : '<%s>', arg.name);
        }).join(' '))));
      } else {
        // validate arguments as configured in commands setup
        for (let i = 0, ln = commandConfigArgs.length; i < ln; i += 1) {
          if (!commandConfigArgs[i].optional) {
            // first arg from Commander is the command, the rest are that command's arguments
            commandConfigArgs[i].rules.forEach(_validate(commanderArgs[i + 1], commandConfigArgs[i].name, 'argument'));
          }
        }
      }
    }

    // validate command opts as configured in commands setup
    if (commandConfigOpts) {
      commandConfigOpts.forEach((commandOpt) => {
        if (commandOpt.rules) {
          const name = commandOpt.arg,
            value = commanderArg[name.match(/<.*>/)[0].replace(/[<>]/g, '')];
          commandOpt.rules.forEach(_validate(value, name, 'option'));
        }
      });
    }

    // validate global opts as configured in commands setup
    if (globalOptsConfig) {
      globalOptsConfig.forEach((globalOptConfig) => {
        if (globalOptConfig.rules) {
          const name = globalOptConfig.arg,
            value = commanderArg.parent[name.match(/<.*>/)[0].replace(/[<>]/g, '')];
          globalOptConfig.rules.forEach(_validate(value, name, 'option'));
        }
      });
    }
  }
}

/**
 * Execute a one-liner command.
 *
 * The output emitted on stderr and stdout of the child process will be written to process.stdout
 * and process.stderr of this process.
 *
 * Fallthrough is handy in situation where there are multiple execs running in sequence/parallel,
 * and they all have to be executed regardless of success/error on either one of them.
 *
 * @param {String} command: command to execute
 * @param {Boolean} fallthrough: allow error to be camouflaged as a non-error
 * @param {Function} cb: standard cb(err, result) callback
 */
function exec(command, fallthrough, cb) {
  execute(command, fallthrough, false, function(err, stdOutOuput, stdErrOuput, result) {
    // drop stdOutOuput and stdErrOuput parameters to keep exec backwards compatible.
    cb(err, result);
  });
}

/**
 * Execute a one-liner command and collect the output.
 *
 * The output emitted on stderr and stdout of the child process will be
 * collected and passed on to the given callback.
 *
 * Fallthrough is handy in situation where there are multiple execs running in sequence/parallel,
 * and they all have to be executed regardless of success/error on either one of them.
 *
 * @param {String} command: command to execute
 * @param {Boolean} fallthrough: allow error to be camouflaged as a non-error
 * @param {Function} cb: (err, stdOutOuput, stdErrOuput, result) callback
 */
function execAndCollect(command, fallthrough, cb) {
  execute(command, fallthrough, true, cb);
}

// not exported
/**
 * Execute a one-liner command.
 *
 * The output emitted on stderr and stdout of the child process will either be written to
 * process.stdout and process.stderr of this process or collected and passed on to the
 * given callback, depending on collectOutput.
 *
 * Fallthrough is handy in situation where there are multiple execs running in sequence/parallel,
 * and they all have to be executed regardless of success/error on either one of them.
 *
 * @param {String} command: command to execute
 * @param {Boolean} fallthrough: allow error to be camouflaged as a non-error
 * @param {Boolean} collectOutput: pass the output of the child process to the callback instead
 *        of writing it to error to be camouflaged as a non-error
 * @param {Function} cb: (err, stdOutOuput, stdErrOuput, result) callback
 * @private
 */
function execute(command, fallthrough, collectOutput, cb) {
  let collectedStdOut = '';
  let collectedStdErr = '';

  const _exec = child.exec(command, function (err) {
    let result;
    if (err && fallthrough) {
      // camouflage error to allow other execs to keep running
      result = err;
      err = null;
    }
    cb(err, collectedStdOut, collectedStdErr, result);
  });

  _exec.stdout.on('data', function (data) {
    if (collectOutput) {
      collectedStdOut += data.toString().trim();
    } else {
      process.stdout.write(colors.green(data.toString()));
    }
  });

  _exec.stderr.on('data', function (data) {
    if (collectOutput) {
      collectedStdErr += data.toString().trim();
    } else {
      process.stderr.write(colors.red(data.toString()));
    }
  });
}

/**
 * Handle process exit based on the existence of error.
 * This is handy for command-line tools to use as the final callback.
 * Exit status code 1 indicates an error, exit status code 0 indicates a success.
 * Error message will be logged to the console. Result object is only used for convenient debugging.
 * Exit is also called with a second method in the signature called 'result', but it's not declared
 * here due to not being used when there is no error and this function simply exits with code 0
 *
 * @param {Error} err: error object existence indicates the occurence of an error
 */
function exit(err) {
  if (err) {
    console.error(colors.red(err.message || JSON.stringify(err)));
    process.exit(1);
  } else {
    process.exit(0);
  }
}

/**
 * A higher order function that returns a process exit callback,
 * with error and success callbacks to handle error and result accordingly.
 * Exit status code 1 indicates an error, exit status code 0 indicates a success.
 *
 * @param {Function} errorCb: error callback accepts error argument, defaults to logging to console error
 * @param {Function} successCb: success callback accepts result argument, defaults to logging to console log
 */
function exitCb(errorCb, successCb) {

  if (!errorCb) {
    errorCb = function (err) {
      console.error(colors.red(err.message || JSON.stringify(err)));
    };
  }

  if (!successCb) {
    successCb = function (result) {
      console.log(colors.green(result.toString()));
    };
  }

  return function (err, result) {
    if (err) {
      errorCb(err);
      process.exit(1);
    } else {
      successCb(result);
      process.exit(0);
    }
  };
}

/**
 * Get an array of files contained in specified items.
 * When a directory is specified, all files contained within that directory and its sub-directories will be included.
 *
 * @param {Array} items: an array of files and/or directories
 * @param {Object} opts: optional
 *   - match: regular expression to match against the file name
 * @return {Array} all files
 */
function files(items, opts) {
  opts = opts || {};
  let data = [];

  function addMatch(item) {
    if (opts.match === undefined || (opts.match && item.match(new RegExp(opts.match)))) {
      data.push(item);
    }
  }

  items.forEach((item) => {
    const stat = fs.statSync(item);

    if (stat.isFile()) {
      addMatch(item);

    } else if (stat.isDirectory()) {
      const _items = wrench.readdirSyncRecursive(item);
      _items.forEach((_item) => {
        _item = p.join(item, _item);
        if (fs.statSync(_item).isFile()) {
          addMatch(_item);
        }
      });
    }
  });
  return data;
}

/**
 * Lookup config values for the specified keys in the following order:
 * - environment variable
 * - if optional file is specified, then check for the value inside the file
 *   file type depends on extension file
 * - if optional enablePrompt is set to true, then prompt the user for config value
 *
 * @param {Array} keys: an array of configuration keys to be looked up
 * @param {Object} opts: optional
 * - file: file name to look up to for the configuration value,
 *         if not supplied then no file lookup will be done
 * - enablePrompt: if true then prompt the user for configuration value
 * @param {Function} cb: standard cb(err, result) callback
 */
function lookupConfig(keys, opts, cb) {

  if (!Array.isArray(keys)) {
    keys = [keys];
  }
  opts.prompt = opts.prompt || false;

  // parse values from configuration file if supplied
  let file = {};
  if (opts.file) {
    const content = this.lookupFile(opts.file);
    if (opts.file.match(/\.json$/)) {
      file.json = JSON.parse(content);
    } else if (opts.file.match(/\.ya?ml$/)) {
      file.yaml = yaml.load(content);
    } else {
      throw new Error('Configuration file extension is not supported');
    }
  }

  function lookup(key, cb) {
    if (process.env[key]) {
      cb(process.env[key]);
    } else if (file.json) {
      cb(file.json[key]);
    } else if (file.yaml) {
      cb(file.yaml[key]);
    } else {
      cb(undefined);
    }
  }

  // lookup for values in environment variables and configuration file
  let tasks = {};
  keys.forEach((key) => {
    tasks[key] = function (cb) {
      lookup(key, function (result) {
        cb(null, result);
      });
    };
  });

  async.parallel(tasks, function (err, results) {

    if (opts.prompt) {
      // prompt users for any keys that don't yet have any value from
      // environment variables and configuration file
      let promptQuestions = [];
      keys.forEach((key) => {
        if (results[key] === undefined) {
          const promptQuestion = {
            name: key,
            message: key,
            default: false,
          };
          if (key.toLowerCase().indexOf('password') >= 0) {
            promptQuestion.type = 'input';
          } else {
            promptQuestion.type = 'password';
          }
          promptQuestions.push(promptQuestion);
        }
      });
      if (promptQuestions.length > 0) {
        inquirer.prompt(promptQuestions).then((promptAnswers) => {
          results = _.extend(results, promptAnswers);
          cb(err, results);
        });
      } else {
        cb(err, results);
      }
    } else {
      cb(err, results);
    }
  });
}

/**
 * Synchronously read file based on these rules:
 * - if path is absolute, then check file at absolute path first
 * - if path is relative, then check file at current working directory
 * - if none of the above exists, check file at user home directory
 * - if none exists, throw an error
 * This allows simple file lookup which allows various locations.
 *
 * @param {String} file: the file name to read
 * @param {Object} opts: optional
 * - platform: needed for unit tests to override platform since node v0.11.x
 *             https://github.com/trevnorris/node/commit/c80f8fa8f108d8db598b260ddf26bafd2ec8a1f8
 * @return {String} content of the file
 */
function lookupFile(file, opts) {
  opts = opts || {};
  let data;
  const platform = opts.platform || process.platform,
    baseDir = file.match(/^\//) ? p.dirname(file) : process.cwd(),
    homeDir = process.env[(platform === 'win32') ? 'USERPROFILE' : 'HOME'],
    files = _.map([ baseDir, homeDir ], function (dir) {
      return p.join(dir, file.match(/^\//) ? p.basename(file) : file);
    });

  for (let i = 0, ln = files.length; i < ln; i += 1) {
    try {
      data = fs.readFileSync(files[i]);
      break;
    } catch (err) {
      // do nothing when unable to read file
    }
  }

  if (data) {
    return data;
  } else {
    throw new Error('Unable to lookup file in ' + files.join(', '));
  }
}

/**
 * Execute a command with an array of arguments.
 * E.g. command: make, arguments: -f somemakefile target1 target2 target3
 *      will be executed as: make -f somemakefile target1 target2 target3
 * NOTE: process.stdout.write and process.stderr.write are used because console.log adds a newline
 *
 * @param {String} command: command to execute
 * @param {Array} args: command arguments
 * @param {Function} cb: standard cb(err, result) callback
 */
function spawn(command, args, cb) {

  const _spawn = child.spawn(command, args);

  _spawn.stdout.on('data', function (data) {
    process.stdout.write(colors.green(data.toString()));
  });

  _spawn.stderr.on('data', function (data) {
    process.stderr.write(colors.red(data.toString()));
  });

  _spawn.on('exit', function (code) {
    cb((code !== 0) ? new Error(code) : undefined, code);
  });
}

const exports = {
  command: command,
  _preCommand: _preCommand,
  _postCommand: _postCommand,
  exec: exec,
  execAndCollect: execAndCollect,
  exit: exit,
  exitCb: exitCb,
  files: files,
  lookupConfig: lookupConfig,
  lookupFile: lookupFile,
  spawn: spawn
};

export {
  exports as default
};