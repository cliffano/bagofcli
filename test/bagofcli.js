"use strict";
/* eslint no-unused-vars: 0 */
import async from "async";
import bag from "../lib/bagofcli.js";
import childProcess from "child_process";
import { program as commander } from "commander";
import fs from "fs";
import inquirer from "inquirer";
import referee from "@sinonjs/referee";
import sinon from "sinon";
import wrench from "wrench-sui";

describe("cli - command", function () {
  beforeEach(function () {
    this.mockCommander = sinon.mock(commander);
    this.mockFs = sinon.mock(fs);
    this.base = "/some/dir";
    this.actions = {
      commands: {
        command1: { action1: function () {} },
        command2: { action2: function () {} },
        command3: { action3: function () {} },
      },
    };
    this.commands = {
      commands: {
        command1: {
          desc: "Command1 description",
          options: [
            {
              arg: "-f, --flag",
              desc: "Flag description",
            },
          ],
        },
        command2: {
          desc: "Command2 description",
        },
      },
    };
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/some/package.json")
      .returns(JSON.stringify({ version: "1.2.3" }));
  });

  afterEach(function () {
    this.mockCommander.verify();
    this.mockCommander.restore();
    this.mockFs.verify();
    this.mockFs.restore();
  });

  it("should use optional command file when specified", function () {
    this.mockCommander.expects("version").once().withExactArgs("1.2.3");
    this.mockCommander.expects("parse").once().withExactArgs(["arg1", "arg2"]);
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/some/dir/commands.json")
      .returns(JSON.stringify(this.commands));
    sinon.stub(process, "argv").value(["arg1", "arg2"]);
    bag.command(this.base, this.actions, {
      commandFile: "commands.json",
    });
  });

  it("should fall back to default command file location when optional command file is not specified", function () {
    this.mockCommander.expects("version").once().withExactArgs("1.2.3");
    this.mockCommander.expects("parse").once().withExactArgs(["arg1", "arg2"]);
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/some/conf/commands.json")
      .returns(JSON.stringify(this.commands));
    sinon.stub(process, "argv").value(["arg1", "arg2"]);
    bag.command(this.base);
  });

  it("should set global options when specified", function () {
    this.mockCommander.expects("version").once().withExactArgs("1.2.3");
    this.mockCommander.expects("parse").once().withExactArgs(["arg1", "arg2"]);
    // add global options
    this.commands.options = [
      {
        arg: "-g, --global",
        desc: "Global description",
        action: function (done) {},
      },
    ];
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/some/conf/commands.json")
      .returns(JSON.stringify(this.commands));
    sinon.stub(process, "argv").value(["arg1", "arg2"]);
    bag.command(this.base);
  });
});

describe("cli - _preCommand", function () {
  beforeEach(function () {
    this.mockCommander = sinon.mock(commander);
    this.mockConsole = sinon.mock(console);
  });

  afterEach(function () {
    this.mockCommander.verify();
    this.mockCommander.restore();
    this.mockConsole.verify();
    this.mockConsole.restore();
  });

  it("should not log anything when commands have empty examples array", function () {
    this.mockCommander.expects("on").once().withArgs("--help").callsArgWith(1);

    const commands = {
      somecommand1: { examples: [] },
      somecommand2: { examples: [] },
    };
    bag._preCommand(commands);
  });

  it("should not log anything when commands do not have any examples fields", function () {
    this.mockCommander.expects("on").once().withArgs("--help").callsArgWith(1);

    const commands = {
      somecommand1: {},
      somecommand2: {},
    };
    bag._preCommand(commands);
  });

  it("should log examples when configured in commands", function () {
    this.mockConsole.expects("log").once().withExactArgs("  Examples:\n");
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs("    %s:", "somecommand1");
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs("      %s", "example1");
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs("      %s", "example2");
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs("    %s:", "somecommand2");
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs("      %s", "example3");
    this.mockCommander.expects("on").once().withArgs("--help").callsArgWith(1);

    const commands = {
      somecommand1: { examples: ["example1", "example2"] },
      somecommand1a: {},
      somecommand2: { examples: ["example3"] },
      somecommand2b: { examples: [] },
    };
    bag._preCommand(commands);
  });
});

describe("cli - _postCommand", function () {
  beforeEach(function () {
    this.mockCommander = sinon.mock(commander);
    this.mockConsole = sinon.mock(console);
    this.mockProcess = sinon.mock(process);
  });

  afterEach(function () {
    this.mockCommander.verify();
    this.mockCommander.restore();
    this.mockConsole.verify();
    this.mockConsole.restore();
    this.mockProcess.verify();
    this.mockProcess.restore();
  });

  it("should return without error when args is empty", function (done) {
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should return without error when commands config is not set up with any args", function (done) {
    this.mockCommander._name = "somecommand";
    this.mockCommander.parent = { _name: "someparentcommand" };
    delete this.mockCommander.args;
    const commandsConfig = { somecommand: {} };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should return without error when command line includes opt flag (commander.args is empty for some reason)", function (done) {
    process.argv = ["node", "somecommand", "--someopt"];
    this.mockCommander.args = [];
    let err, result;
    try {
      result = bag._postCommand([]);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log usage message and exit when commands config has args but the command does not provide any argument", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Usage: someprogram somecommand <arg1> <arg2>".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = {
        somecommand: {
          args: [
            { name: "arg1", rules: ["number"] },
            { name: "arg2", rules: ["number"] },
          ],
        },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should log usage message when there is a mix of mandatory and optional args in command config but command does not provide any argument", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Usage: someprogram somecommand <arg1> <arg2> [arg3]".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = {
        somecommand: {
          args: [
            { name: "arg1", rules: ["number"] },
            { name: "arg2", rules: ["number"] },
            { name: "arg3", optional: true },
          ],
        },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should log usage message when there are multiple optional args in command config but command does not provide any argument", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Usage: someprogram somecommand <arg1> [arg2] [arg3]".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = {
        somecommand: {
          args: [
            { name: "arg1", rules: ["number"] },
            { name: "arg2", optional: true },
            { name: "arg3", optional: true },
          ],
        },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should log error message when there is an invalid argument", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be number".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "foobar"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["number"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should log error message when empty string is passed on required rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be required".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", ""];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["required"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should log error message when non-email string is passed on email rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be email".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "foobar"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["email"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  // The following rules were available via iz but had no test coverage of their
  // own; now that validation is backed by validator instead of iz, each rule
  // gets a valid and an invalid case (where both are actually reachable through
  // a positional CLI argument, which is always a string).

  it("should return without error when a string is passed on string rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "anything"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["string"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should return without error when a whole number is passed on int rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "42"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["int"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when a decimal is passed on int rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be int".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "12.5"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["int"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when a decimal is passed on decimal rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "12.5"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["decimal"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when a whole number is passed on decimal rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be decimal".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "42"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["decimal"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when a boolean-like string is passed on boolean rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "true"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["boolean"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when a non-boolean string is passed on boolean rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be boolean".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "notabool"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["boolean"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when an alphanumeric string is passed on alphaNumeric rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "abc123"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["alphaNumeric"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when a non-alphanumeric string is passed on alphaNumeric rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be alphaNumeric".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "abc-123"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["alphaNumeric"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should log error message when anArray rule is applied to a positional argument", function () {
    // Positional CLI arguments are always strings, so anArray - which requires
    // an actual Array - can never pass for one; documenting that behaviour here.
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be anArray".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "1,2,3"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["anArray"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when an ISO date string is passed on date rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "2020-01-05"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["date"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when a non-date string is passed on date rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be date".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "notadate"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["date"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when an IP address is passed on ip rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "192.168.1.1"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["ip"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when a non-IP string is passed on ip rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be ip".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "not.an.ip"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["ip"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when a valid credit card number is passed on cc rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "4111111111111111"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["cc"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when an invalid credit card number is passed on cc rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be cc".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "1234567890123456"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["cc"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when a US mobile number is passed on phone rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "4155552671"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["phone"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when an invalid phone number is passed on phone rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be phone".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "123"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["phone"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when a US postal code is passed on postal rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "90210"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["postal"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when an invalid postal code is passed on postal rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be postal".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "abcde"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["postal"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when a 9-digit number is passed on ssn rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "123456789"];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["ssn"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when a non-9-digit number is passed on ssn rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be ssn".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "12345"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["ssn"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when an empty string is passed on blank rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", ""];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["blank"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when a non-empty string is passed on blank rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be blank".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "notblank"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["blank"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when an empty string is passed on empty rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", ""];
    const commandsConfig = {
      somecommand: { args: [{ name: "arg1", rules: ["empty"] }] },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when a non-empty string is passed on empty rule", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid argument: <arg1> must be empty".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "notempty"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["empty"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should log error message when rule does not exist", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs(
        "Invalid argument rule: someRuleThatCantPossiblyExist".red,
      );
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "foobar"];
    const commandsConfig = {
        somecommand: {
          args: [{ name: "arg1", rules: ["someRuleThatCantPossiblyExist"] }],
        },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should return without error when command has valid argument as configured in commands setup file", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand", "123"];
    const commandsConfig = {
      somecommand: {
        args: [
          { name: "arg1", rules: ["number"] },
          { name: "arg2", optional: true },
        ],
      },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should validate against the matching subcommand's own args instead of the top-level commander args when a command has both declared args and its own options (regression test for command-scoped option leaking into the top-level arg count)", function (done) {
    this.mockCommander._name = "someprogram";
    // Simulates an option registered only on the subcommand: the top-level
    // commander.args leaks the raw unconsumed option tokens (as Commander's own
    // top-level parse doesn't know about that option), while the actual invoked
    // subcommand's own .args correctly holds just the real positional args.
    this.mockCommander.args = [
      "somecommand",
      "123",
      "--some-command-opt",
      "someval",
    ];
    this.mockCommander.commands = [
      {
        name: () => "somecommand",
        args: ["123"],
      },
    ];
    const commandsConfig = {
      somecommand: {
        args: [{ name: "arg1", rules: ["number"] }],
      },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message and exit when command is unknown", function () {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs(
        "Unknown command: someunknowncommand, use --help for more info".red,
      );
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["someunknowncommand"];
    const commandsConfig = {
        somecommand: { args: [{ name: "arg1", rules: ["string"] }] },
      },
      result = bag._postCommand(this.mockCommander, commandsConfig);
    referee.assert.isUndefined(result);
  });

  it("should log error message when command has invalid command option", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs(
        "Invalid option: <-s, --some-arg <someArg>> must be number".red,
      );
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.someArg = "abcdef";
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = {
      somecommand: {
        options: [
          {
            arg: "-s, --some-arg <someArg>",
            rules: ["number"],
          },
        ],
      },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should return without error when there is no invalid command option", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.someArg = "12345";
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = {
      somecommand: {
        options: [
          {
            arg: "-s, --some-arg <someArg>",
            rules: ["number"],
          },
        ],
      },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should return without error when command option does not have any validation rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.someArg = "abcdef";
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = {
      somecommand: {
        options: [
          {
            arg: "-s, --some-arg <someArg>",
          },
        ],
      },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when command option value is retrieved from opts", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs(
        "Invalid option: <-s, --some-arg <someArg>> must be number".red,
      );
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.opts = sinon.stub().returns({ someArg: "abcdef" });
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = {
      somecommand: {
        options: [
          {
            arg: "-s, --some-arg <someArg>",
            rules: ["number"],
          },
        ],
      },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.equals(this.mockCommander.opts.callCount, 1);
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when command option arg does not contain value placeholder", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("Invalid option: <-s, --some-arg> must be number".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = {
      somecommand: {
        options: [
          {
            arg: "-s, --some-arg",
            rules: ["number"],
          },
        ],
      },
    };
    let err, result;
    try {
      result = bag._postCommand(this.mockCommander, commandsConfig);
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when command has invalid global option", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs(
        "Invalid option: <-s, --some-arg <someArg>> must be number".red,
      );
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.parent = { someArg: "abcdef" };
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = { somecommand: {} },
      globalOptsConfig = [
        {
          arg: "-s, --some-arg <someArg>",
          rules: ["number"],
        },
      ];
    let err, result;
    try {
      result = bag._postCommand(
        this.mockCommander,
        commandsConfig,
        globalOptsConfig,
      );
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should return without error when there is no invalid global option", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.parent = { someArg: 12345 };
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = { somecommand: {} },
      globalOptsConfig = [
        {
          arg: "-s, --some-arg <someArg>",
          rules: ["number"],
        },
      ];
    let err, result;
    try {
      result = bag._postCommand(
        this.mockCommander,
        commandsConfig,
        globalOptsConfig,
      );
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should log error message when global option source is undefined", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs(
        "Invalid option: <-s, --some-arg <someArg>> must be number".red,
      );
    this.mockProcess.expects("exit").once().withExactArgs(1);
    this.mockCommander._name = "someprogram";
    this.mockCommander.parent = undefined;
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = { somecommand: {} },
      globalOptsConfig = [
        {
          arg: "-s, --some-arg <someArg>",
          rules: ["number"],
        },
      ];
    let err, result;
    try {
      result = bag._postCommand(
        this.mockCommander,
        commandsConfig,
        globalOptsConfig,
      );
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });

  it("should return without error when global option does not have any validation rule", function (done) {
    this.mockCommander._name = "someprogram";
    this.mockCommander.parent = { someArg: "abcdef" };
    this.mockCommander.args = ["somecommand"];
    const commandsConfig = { somecommand: {} },
      globalOptsConfig = [
        {
          arg: "-s, --some-arg <someArg>",
        },
      ];
    let err, result;
    try {
      result = bag._postCommand(
        this.mockCommander,
        commandsConfig,
        globalOptsConfig,
      );
    } catch (e) {
      err = e;
    }
    referee.assert.isUndefined(result);
    done(err);
  });
});

describe("cli - exec", function () {
  beforeEach(function (done) {
    this.mockProcessStdout = sinon.mock(process.stdout);
    this.mockProcessStderr = sinon.mock(process.stderr);
    done();
  });

  afterEach(function (done) {
    this.mockProcessStdout.verify();
    this.mockProcessStdout.restore();
    this.mockProcessStderr.verify();
    this.mockProcessStderr.restore();
    done();
  });

  it("should log stdout output and camouflage error to callback when an error occurs and fallthrough is allowed", function (done) {
    this.mockProcessStdout
      .expects("write")
      .once()
      .withExactArgs("somestdout".green);
    this.mockProcessStdout.expects("write").once().withArgs(sinon.match.string); // allow mocha test title display
    const mockExec = {
      stdout: {
        on: function (event, cb) {
          cb("somestdout");
        },
      },
      stderr: { on: function (event, cb) {} },
    };
    sinon.stub(childProcess, "exec").value((command, cb) => {
      referee.assert.equals(command, "somecommand");
      cb(new Error("someerror"));
      return mockExec;
    });
    bag.exec("somecommand", true, function cb(err, result) {
      referee.assert.isNull(err);
      referee.assert.equals(result.message, "someerror");
      done();
    });
  });

  it("should log stderr output and pass error to callback when an error occurs and fallthrough is not allowed", function (done) {
    this.mockProcessStderr
      .expects("write")
      .once()
      .withExactArgs("somestderr".red);
    const mockExec = {
      stdout: { on: function (event, cb) {} },
      stderr: {
        on: function (event, cb) {
          cb("somestderr");
        },
      },
    };
    sinon.stub(childProcess, "exec").value((command, cb) => {
      referee.assert.equals(command, "somecommand");
      cb(new Error("someerror"));
      return mockExec;
    });
    bag.exec("somecommand", false, function cb(err, result) {
      referee.assert.equals(err.message, "someerror");
      referee.assert.isUndefined(result);
      done();
    });
  });
});

describe("cli - execAndCollect", function () {
  beforeEach(function (done) {
    this.mockProcessStdout = sinon.mock(process.stdout);
    this.mockProcessStderr = sinon.mock(process.stderr);
    done();
  });

  afterEach(function (done) {
    this.mockProcessStdout.verify();
    this.mockProcessStdout.restore();
    this.mockProcessStderr.verify();
    this.mockProcessStderr.restore();
    done();
  });

  it("should collect stdout and stderr output", function (done) {
    this.mockProcessStdout.expects("write").once().withArgs(sinon.match.string); // allow mocha test title display
    this.mockProcessStderr.expects("write").never();
    const mockExec = {
      stdout: {
        on: function (event, cb) {
          cb("stdout output 1");
          cb("stdout output 2");
        },
      },
      stderr: {
        on: function (event, cb) {
          cb("stderr output 1");
          cb("stderr output 2");
        },
      },
    };
    sinon.stub(childProcess, "exec").value((command, cb) => {
      referee.assert.equals(command, "somecommand");

      // give bagofcli#execute time to set up stdout.on and stderr.on handlers, check assertions after
      // next tick.
      async.setImmediate(function () {
        cb(null);
      });
      return mockExec;
    });
    bag.execAndCollect(
      "somecommand",
      false,
      function cb(err, stdOut, stdErr, result) {
        referee.assert.isNull(err);
        referee.assert.equals(stdOut, "stdout output 1stdout output 2");
        referee.assert.equals(stdErr, "stderr output 1stderr output 2");
        referee.assert.isUndefined(result);
        done();
      },
    );
  });

  it("should collect stdout and stderr output and camouflage error to callback when an error occurs and fallthrough is allowed", function (done) {
    this.mockProcessStdout.expects("write").once().withArgs(sinon.match.string); // allow mocha test title display
    this.mockProcessStderr.expects("write").never();
    const mockExec = {
      stdout: {
        on: function (event, cb) {
          cb("stdout output 1");
          cb("stdout output 2");
        },
      },
      stderr: {
        on: function (event, cb) {
          cb("stderr output 1");
          cb("stderr output 2");
        },
      },
    };
    sinon.stub(childProcess, "exec").value((command, cb) => {
      referee.assert.equals(command, "somecommand");

      // give bagofcli#execute time to set up stdout.on and stderr.on handlers, check assertions after
      // next tick.
      async.setImmediate(function () {
        cb(new Error("someerror"));
      });
      return mockExec;
    });
    bag.execAndCollect(
      "somecommand",
      true,
      function cb(err, stdOut, stdErr, result) {
        referee.assert.isNull(err);
        referee.assert.equals(stdOut, "stdout output 1stdout output 2");
        referee.assert.equals(stdErr, "stderr output 1stderr output 2");
        referee.assert.equals(result.message, "someerror");
        done();
      },
    );
  });

  it("should collect stdout and stderr output and pass error to callback when an error occurs and fallthrough is not allowed", function (done) {
    this.mockProcessStdout.expects("write").once().withArgs(sinon.match.string); // allow mocha test title display
    this.mockProcessStderr.expects("write").never();
    const mockExec = {
      stdout: {
        on: function (event, cb) {
          cb("stdout output 1");
          cb("stdout output 2");
        },
      },
      stderr: {
        on: function (event, cb) {
          cb("stderr output 1");
          cb("stderr output 2");
        },
      },
    };
    sinon.stub(childProcess, "exec").value((command, cb) => {
      referee.assert.equals(command, "somecommand");
      // give bagofcli#execute time to set up stdout.on and stderr.on handlers, check assertions after
      // next tick.
      async.setImmediate(() => {
        cb(new Error("someerror"));
      });
      return mockExec;
    });
    bag.execAndCollect(
      "somecommand",
      false,
      function cb(err, stdOut, stdErr, result) {
        referee.assert.equals(err.message, "someerror");
        referee.assert.equals(stdOut, "stdout output 1stdout output 2");
        referee.assert.equals(stdErr, "stderr output 1stderr output 2");
        referee.assert.isUndefined(result);
        done();
      },
    );
  });
});

describe("cli - exit", function () {
  beforeEach(function (done) {
    this.mockConsole = sinon.mock(console);
    this.mockProcess = sinon.mock(process);
    done();
  });

  afterEach(function (done) {
    this.mockConsole.verify();
    this.mockConsole.restore();
    this.mockProcess.verify();
    this.mockProcess.restore();
    done();
  });

  it("should exit with status code 0 when error does not exist", function (done) {
    this.mockProcess.expects("exit").once().withExactArgs(0);
    bag.exit();
    done();
  });

  it("should exit with status code 1 and logs the error message when error exists", function (done) {
    this.mockConsole.expects("error").once().withExactArgs("someerror".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    bag.exit(new Error("someerror"));
    done();
  });

  it("should log the stringified object when error is a non-Error object", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs('{"error":"someerror"}'.red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    bag.exit({ error: "someerror" });
    done();
  });

  it("should log the stringified when error is an array", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs('["some error 1","some error 2"]'.red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    bag.exit(["some error 1", "some error 2"]);
    done();
  });
});

describe("cli - exitCb", function () {
  beforeEach(function (done) {
    this.mockConsole = sinon.mock(console);
    this.mockProcess = sinon.mock(process);
    done();
  });

  afterEach(function (done) {
    this.mockConsole.verify();
    this.mockConsole.restore();
    this.mockProcess.verify();
    this.mockProcess.restore();
    done();
  });

  it("should exit with status code 0 and logs the result when error does not exist and no success callback is specified", function (done) {
    this.mockConsole.expects("log").once().withExactArgs("some success".green);
    this.mockProcess.expects("exit").once().withExactArgs(0);
    bag.exitCb()(null, "some success");
    done();
  });

  it("should exit with status code 1 and logs the error message when error exists and no error callback is specified", function (done) {
    this.mockConsole.expects("error").once().withExactArgs("some error".red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    bag.exitCb()(new Error("some error"));
    done();
  });

  it("should exit with status code 1 and logs stringified object when error is non-Error object", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs('{"error":"some error"}'.red);
    this.mockProcess.expects("exit").once().withExactArgs(1);
    bag.exitCb()({ error: "some error" });
    done();
  });

  it("should exit with status code 0 and call success callback when error does not exist and success callback is specified", function (done) {
    this.mockProcess.expects("exit").once().withExactArgs(0);
    bag.exitCb(null, (result) => {
      referee.assert.equals(result, "some success");
      done();
    })(null, "some success");
  });

  it("should exit with status code 1 and call error callback when error exists and error callback is specified", function (done) {
    this.mockProcess.expects("exit").once().withExactArgs(1);
    bag.exitCb((err) => {
      referee.assert.equals(err.message, "some error");
      done();
    })(new Error("some error"));
  });

  it("should pass stringified error when error is non-Error object", function (done) {
    this.mockProcess.expects("exit").once().withExactArgs(1);
    bag.exitCb((err) => {
      referee.assert.equals(err, { error: "someerror" });
      done();
    })({ error: "someerror" });
  });
});

describe("cli - files", function () {
  beforeEach(function (done) {
    this.mockFs = sinon.mock(fs);
    this.mockWrench = sinon.mock(wrench);
    this.trueFn = function () {
      return true;
    };
    this.falseFn = function () {
      return false;
    };
    done();
  });

  afterEach(function (done) {
    this.mockFs.verify();
    this.mockFs.restore();
    this.mockWrench.verify();
    this.mockWrench.restore();
    done();
  });

  it("should return files as-is when all items are files", function (done) {
    this.mockFs
      .expects("statSync")
      .withExactArgs("file1")
      .returns({ isFile: this.trueFn });
    this.mockFs
      .expects("statSync")
      .withExactArgs("file2")
      .returns({ isFile: this.trueFn });
    const files = bag.files(["file1", "file2"]);
    referee.assert.equals(files, ["file1", "file2"]);
    done();
  });

  it("should return files under a directory", function (done) {
    this.mockWrench
      .expects("readdirSyncRecursive")
      .withExactArgs("dir1")
      .returns(["file1", "file2"]);
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1")
      .returns({ isFile: this.falseFn, isDirectory: this.trueFn });
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1/file1")
      .returns({ isFile: this.trueFn });
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1/file2")
      .returns({ isFile: this.trueFn });
    const files = bag.files(["dir1"]);
    referee.assert.equals(files, ["dir1/file1", "dir1/file2"]);
    done();
  });

  it("should only return matching files when match opt is specified", function (done) {
    this.mockWrench
      .expects("readdirSyncRecursive")
      .withExactArgs("dir1")
      .returns(["file1", "file2"]);
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1")
      .returns({ isFile: this.falseFn, isDirectory: this.trueFn });
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1/file1")
      .returns({ isFile: this.trueFn });
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1/file2")
      .returns({ isFile: this.trueFn });
    this.mockFs
      .expects("statSync")
      .withExactArgs("file2")
      .returns({ isFile: this.trueFn });
    const files = bag.files(["dir1", "file2"], { match: "2$" });
    referee.assert.equals(files, ["dir1/file2", "file2"]);
    done();
  });

  it("should return nothing when no match is found", function (done) {
    this.mockWrench
      .expects("readdirSyncRecursive")
      .withExactArgs("dir1")
      .returns(["file1"]);
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1")
      .returns({ isFile: this.falseFn, isDirectory: this.trueFn });
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1/file1")
      .returns({ isFile: this.trueFn });
    this.mockFs
      .expects("statSync")
      .withExactArgs("file1")
      .returns({ isFile: this.trueFn });
    const files = bag.files(["dir1", "file1"], { match: "2$" });
    referee.assert.equals(files, []);
    done();
  });

  it("should return nothing when directory contains non-directory and non-file", function (done) {
    this.mockWrench
      .expects("readdirSyncRecursive")
      .withExactArgs("dir1")
      .returns(["item1"]);
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1")
      .returns({ isFile: this.falseFn, isDirectory: this.trueFn });
    this.mockFs
      .expects("statSync")
      .withExactArgs("dir1/item1")
      .returns({ isFile: this.falseFn, isDirectory: this.falseFn });
    const files = bag.files(["dir1"]);
    referee.assert.equals(files, []);
    done();
  });

  it("should return nothing when items are non-directory and non-file", function (done) {
    this.mockFs
      .expects("statSync")
      .withExactArgs("item1")
      .returns({ isFile: this.falseFn, isDirectory: this.falseFn });
    const files = bag.files(["item1"]);
    referee.assert.equals(files, []);
    done();
  });
});

describe("cli - lookupConfig", function () {
  beforeEach(function (done) {
    this.mockInquirer = sinon.mock(inquirer);
    done();
  });

  afterEach(function (done) {
    this.mockInquirer.verify();
    this.mockInquirer.restore();
    if (bag.lookupFile.restore) {
      bag.lookupFile.restore();
    }
    done();
  });

  it("should pass value when single configuration key exists as environment variable", function (done) {
    process.env.somekey = "somevalue";
    bag.lookupConfig("somekey", {}, function (err, result) {
      referee.assert.equals(err, null);
      referee.assert.equals(result.somekey, "somevalue");
      done();
    });
  });

  it("should pass values when multiple configuration keys exists as environment variables", function (done) {
    process.env.somekey = "somevalue";
    process.env.anotherkey = "anothervalue";
    bag.lookupConfig(["somekey", "anotherkey"], {}, function (err, result) {
      referee.assert.equals(err, null);
      referee.assert.equals(result.somekey, "somevalue");
      referee.assert.equals(result.anotherkey, "anothervalue");
      done();
    });
  });

  it("should pass undefined when configuration key does not exist at all", function (done) {
    process.env.somekey = "somevalue";
    process.env.anotherkey = "anothervalue";
    bag.lookupConfig(["mykey"], {}, function (err, result) {
      referee.assert.equals(err, null);
      referee.assert.isUndefined(result.mykey);
      done();
    });
  });

  it("should pass values when multiple configuration keys exists in a json file", function (done) {
    process.env.somekey = "somevalue";
    process.env.anotherkey = "anothervalue";
    sinon.stub(bag, "lookupFile").callsFake((file) => {
      return '{ "somekey": "somevalue", "anotherkey": "anothervalue" }';
    });
    bag.lookupConfig(
      ["somekey", "anotherkey"],
      { file: "someconffile.json" },
      function (err, result) {
        referee.assert.equals(err, null);
        referee.assert.equals(result.somekey, "somevalue");
        referee.assert.equals(result.anotherkey, "anothervalue");
        done();
      },
    );
  });

  it("should pass undefined when configuration key does not exist in a json file", function (done) {
    delete process.env.somekey;
    delete process.env.anotherkey;
    sinon.stub(bag, "lookupFile").callsFake((file) => {
      return "{}";
    });
    bag.lookupConfig(
      ["somekey", "anotherkey"],
      { file: "someconffile.json" },
      function (err, result) {
        referee.assert.equals(err, null);
        referee.assert.isUndefined(result.somekey);
        referee.assert.isUndefined(result.anotherkey);
        done();
      },
    );
  });

  it("should pass values when multiple configuration keys exists in a yaml file", function (done) {
    delete process.env.somekey;
    delete process.env.anotherkey;
    sinon.stub(bag, "lookupFile").callsFake((file) => {
      return "---\nsomekey: somevalue\nanotherkey: anothervalue";
    });
    bag.lookupConfig(
      ["somekey", "anotherkey"],
      { file: "someconffile.yaml" },
      function (err, result) {
        referee.assert.equals(err, null);
        referee.assert.equals(result.somekey, "somevalue");
        referee.assert.equals(result.anotherkey, "anothervalue");
        done();
      },
    );
  });

  it("should pass undefined when configuration key does not exist in a yaml file", function (done) {
    delete process.env.somekey;
    delete process.env.anotherkey;
    sinon.stub(bag, "lookupFile").callsFake((file) => {
      return "";
    });
    bag.lookupConfig(
      ["somekey", "anotherkey"],
      { file: "someconffile.yaml" },
      function (err, result) {
        referee.assert.equals(err, null);
        referee.assert.isUndefined(result.somekey);
        referee.assert.isUndefined(result.anotherkey);
        done();
      },
    );
  });

  it("should throw error when configuration file extension is unsupported", function (done) {
    delete process.env.somekey;
    delete process.env.anotherkey;
    sinon.stub(bag, "lookupFile").callsFake((file) => {
      return "";
    });
    try {
      bag.lookupConfig(
        ["somekey", "anotherkey"],
        { file: "someconffile.txt" },
        function (err, result) {},
      );
    } catch (e) {
      referee.assert.equals(
        e.message,
        "Configuration file extension is not supported",
      );
      done();
    }
  });

  it("should prompt for values when configuration file does not exist as environment variables and in configuration file", function (done) {
    delete process.env.somekey;
    delete process.env.anotherkey;
    sinon.stub(bag, "lookupFile").callsFake((file) => {
      return "";
    });
    const expectedPromptQuestions = [
      {
        name: "somepasswordkey",
        message: "somepasswordkey",
        default: false,
        type: "input",
      },
      {
        name: "anotherkey",
        message: "anotherkey",
        default: false,
        type: "password",
      },
    ];
    const mockThen = {
      then: function (cb) {
        cb({ somepasswordkey: "somevalue", anotherkey: "anothervalue" });
      },
    };
    this.mockInquirer
      .expects("prompt")
      .once()
      .withArgs(expectedPromptQuestions)
      .returns(mockThen);
    bag.lookupConfig(
      ["somepasswordkey", "anotherkey"],
      { file: "someconffile.yaml", prompt: true },
      function (err, result) {
        referee.assert.equals(err, null);
        referee.assert.equals(result.somepasswordkey, "somevalue");
        referee.assert.equals(result.anotherkey, "anothervalue");
        done();
      },
    );
  });

  it("should retrieve values from various sources", function (done) {
    process.env.somekey = "somevalue";
    sinon.stub(bag, "lookupFile").callsFake((file) => {
      return "anotherkey: anothervalue";
    });
    const expectedPromptQuestions = [
      {
        name: "somepasswordkey",
        message: "somepasswordkey",
        default: false,
        type: "input",
      },
      {
        name: "inexistingkey",
        message: "inexistingkey",
        default: false,
        type: "password",
      },
    ];
    const mockThen = {
      then: function (cb) {
        cb({ somepasswordkey: "somepasswordvalue", inexistingkey: undefined });
      },
    };
    this.mockInquirer
      .expects("prompt")
      .once()
      .withArgs(expectedPromptQuestions)
      .returns(mockThen);
    bag.lookupConfig(
      ["somekey", "anotherkey", "somepasswordkey", "inexistingkey"],
      { file: "someconffile.yaml", prompt: true },
      function (err, result) {
        referee.assert.equals(err, null);
        referee.assert.equals(result.somekey, "somevalue");
        referee.assert.equals(result.somepasswordkey, "somepasswordvalue");
        referee.assert.equals(result.anotherkey, "anothervalue");
        referee.assert.isUndefined(result.inexistingkey);
        done();
      },
    );
  });

  it("should return undefined when keys do not exist", function (done) {
    process.env.somekey = "somevalue";
    sinon.stub(bag, "lookupFile").callsFake((file) => {
      return "anotherkey: anothervalue";
    });
    bag.lookupConfig(
      [],
      { file: "someconffile.yaml", prompt: true },
      function (err, result) {
        referee.assert.equals(err, null);
        referee.assert.equals(result, {});
        done();
      },
    );
  });
});

describe("cli - lookupFile", function () {
  beforeEach(function (done) {
    this.mockProcess = sinon.mock(process);
    this.mockFs = sinon.mock(fs);
    done();
  });

  afterEach(function (done) {
    this.mockProcess.verify();
    this.mockProcess.restore();
    this.mockFs.verify();
    this.mockFs.restore();
    done();
  });

  it("should return file content in current directory when it exists", function (done) {
    this.mockProcess.expects("cwd").once().returns("/curr/dir");
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/curr/dir/.conf.json")
      .returns("currdirfilecontent");
    const data = bag.lookupFile(".conf.json");
    referee.assert.equals(data, "currdirfilecontent");
    done();
  });

  it("should return file content in home directory when it exists but none exists in current directory and platform is windows", function (done) {
    this.mockProcess.expects("cwd").once().returns("/curr/dir");
    process.env.USERPROFILE = "/home/dir";
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/curr/dir/.conf.json")
      .throws(new Error("doesnotexist"));
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/home/dir/.conf.json")
      .returns("homedirfilecontent");
    const data = bag.lookupFile(".conf.json", { platform: "win32" });
    referee.assert.equals(data, "homedirfilecontent");
    done();
  });

  it("should return file content in home directory when it exists but none exists in current directory and platform is non windows", function (done) {
    this.mockProcess.expects("cwd").once().returns("/curr/dir");
    process.env.HOME = "/home/dir";
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/curr/dir/.conf.json")
      .throws(new Error("doesnotexist"));
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/home/dir/.conf.json")
      .returns("homedirfilecontent");
    const data = bag.lookupFile(".conf.json", { platform: "linux" });
    referee.assert.equals(data, "homedirfilecontent");
    done();
  });

  it("should throw an error when configuration file does not exist anywhere and file has relative path", function (done) {
    this.mockProcess.expects("cwd").once().returns("/curr/dir");
    process.env.HOME = "/home/dir";
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/curr/dir/.conf.json")
      .throws(new Error("doesnotexist"));
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/home/dir/.conf.json")
      .throws(new Error("doesnotexist"));
    try {
      bag.lookupFile(".conf.json", { platform: "linux" });
    } catch (err) {
      referee.assert.equals(
        err.message,
        "Unable to lookup file in /curr/dir/.conf.json, /home/dir/.conf.json",
      );
      done();
    }
  });

  it("should return file content with absolute path when it exists", function (done) {
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/absolute/dir/.conf.json")
      .returns("absolutedirfilecontent");
    const data = bag.lookupFile("/absolute/dir/.conf.json");
    referee.assert.equals(data, "absolutedirfilecontent");
    done();
  });

  it("should throw an error when configuration file does not exist anywhere and file has absolute path", function (done) {
    process.env.HOME = "/home/dir";
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/absolute/dir/.conf.json")
      .throws(new Error("doesnotexist"));
    this.mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/home/dir/.conf.json")
      .throws(new Error("doesnotexist"));
    try {
      bag.lookupFile("/absolute/dir/.conf.json", { platform: "linux" });
    } catch (err) {
      referee.assert.equals(
        err.message,
        "Unable to lookup file in /absolute/dir/.conf.json, /home/dir/.conf.json",
      );
      done();
    }
  });
});

describe("cli - spawn", function () {
  beforeEach(function (done) {
    this.mockChildProcess = sinon.mock(childProcess);
    this.mockProcessStdout = sinon.mock(process.stdout);
    this.mockProcessStderr = sinon.mock(process.stderr);
    done();
  });

  afterEach(function (done) {
    this.mockChildProcess.verify();
    this.mockChildProcess.restore();
    this.mockProcessStdout.verify();
    this.mockProcessStdout.restore();
    this.mockProcessStderr.verify();
    this.mockProcessStderr.restore();
    done();
  });

  it("should write data via stdout and stderr when data event is emitted", function (done) {
    this.mockProcessStdout
      .expects("write")
      .once()
      .withExactArgs("somestdoutdata".green);
    this.mockProcessStdout.expects("write").once().withArgs(sinon.match.string); // allow mocha test title display
    this.mockProcessStderr
      .expects("write")
      .once()
      .withExactArgs("somestderrdata".red);
    const mockSpawn = {
      stdout: {
        on: function (event, cb) {
          referee.assert.equals(event, "data");
          cb("somestdoutdata");
        },
      },
      stderr: {
        on: function (event, cb) {
          referee.assert.equals(event, "data");
          cb("somestderrdata");
        },
      },
      on: function (event, cb) {},
    };
    this.mockChildProcess
      .expects("spawn")
      .withExactArgs("somecommand", ["arg1", "arg2"])
      .returns(mockSpawn);
    bag.spawn("somecommand", ["arg1", "arg2"]);
    done();
  });

  it("should pass error and exit code to callback when exit code is not 0", function (done) {
    const mockSpawn = {
      stdout: { on: function (event, cb) {} },
      stderr: { on: function (event, cb) {} },
      on: function (event, cb) {
        referee.assert.equals(event, "exit");
        cb(1);
      },
    };
    this.mockChildProcess
      .expects("spawn")
      .withExactArgs("somecommand", ["arg1", "arg2"])
      .returns(mockSpawn);
    bag.spawn("somecommand", ["arg1", "arg2"], function (err, result) {
      referee.assert.equals(err.message, "1");
      referee.assert.equals(result, 1);
      done();
    });
  });

  it("should pass no error and exit code to callback when exit code is 0", function (done) {
    const mockSpawn = {
      stdout: { on: function (event, cb) {} },
      stderr: { on: function (event, cb) {} },
      on: function (event, cb) {
        referee.assert.equals(event, "exit");
        cb(0);
      },
    };
    this.mockChildProcess
      .expects("spawn")
      .withExactArgs("somecommand", ["arg1", "arg2"])
      .returns(mockSpawn);
    bag.spawn("somecommand", ["arg1", "arg2"], function (err, result) {
      referee.assert.isUndefined(err);
      referee.assert.equals(result, 0);
      done();
    });
  });
});

describe("cli - logStepHeading", function () {
  beforeEach(function () {
    this.mockConsole = sinon.mock(console);
  });

  afterEach(function () {
    this.mockConsole.verify();
    this.mockConsole.restore();
  });

  it("should write coloured message via console log", function (done) {
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs(
        "%s",
        "\u001b[1m\u001b[36msome heading message\u001b[39m\u001b[22m",
      );
    bag.logStepHeading("some heading message");
    done();
  });

  it("should write coloured message with labels via console log", function (done) {
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs(
        "%s %s",
        "\u001b[45mdry run | temp\u001b[49m",
        "\u001b[1m\u001b[36msome heading message\u001b[39m\u001b[22m",
      );
    bag.logStepHeading("some heading message", { labels: ["dry run", "temp"] });
    done();
  });
});

describe("cli - logStepItemSuccess", function () {
  beforeEach(function () {
    this.mockConsole = sinon.mock(console);
  });

  afterEach(function () {
    this.mockConsole.verify();
    this.mockConsole.restore();
  });

  it("should write coloured message via console log", function (done) {
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs("  * %s", "\u001b[32msome success message\u001b[39m");
    bag.logStepItemSuccess("some success message");
    done();
  });

  it("should write coloured message with labels via console log", function (done) {
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs(
        "  * %s %s",
        "\u001b[45mdry run | temp\u001b[49m",
        "\u001b[32msome success message\u001b[39m",
      );
    bag.logStepItemSuccess("some success message", {
      labels: ["dry run", "temp"],
    });
    done();
  });
});

describe("cli - logStepItemWarning", function () {
  beforeEach(function () {
    this.mockConsole = sinon.mock(console);
  });

  afterEach(function () {
    this.mockConsole.verify();
    this.mockConsole.restore();
  });

  it("should write coloured message via console log", function (done) {
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs("  * %s", "\u001b[33msome warning message\u001b[39m");
    bag.logStepItemWarning("some warning message");
    done();
  });

  it("should write coloured message with labels via console log", function (done) {
    this.mockConsole
      .expects("log")
      .once()
      .withExactArgs(
        "  * %s %s",
        "\u001b[45mdry run | temp\u001b[49m",
        "\u001b[33msome warning message\u001b[39m",
      );
    bag.logStepItemWarning("some warning message", {
      labels: ["dry run", "temp"],
    });
    done();
  });
});

describe("cli - logStepItemError", function () {
  beforeEach(function () {
    this.mockConsole = sinon.mock(console);
  });

  afterEach(function () {
    this.mockConsole.verify();
    this.mockConsole.restore();
  });

  it("should write coloured message via console error", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs("  * %s", "\u001b[31msome error message\u001b[39m");
    bag.logStepItemError("some error message");
    done();
  });

  it("should write coloured message with labels via console error", function (done) {
    this.mockConsole
      .expects("error")
      .once()
      .withExactArgs(
        "  * %s %s",
        "\u001b[45mdry run | temp\u001b[49m",
        "\u001b[31msome error message\u001b[39m",
      );
    bag.logStepItemError("some error message", { labels: ["dry run", "temp"] });
    done();
  });
});

describe("cli - command action wrapper", function () {
  afterEach(function () {
    sinon.restore();
  });

  // NOTE: commander's `program` singleton keeps its "-V, --version" option registered
  // for the lifetime of the process once command() runs it for real (unmocked), so only
  // one test in this describe block can call bag.command() without mocking
  // commander.version() - hence a single combined test rather than two separate ones.
  it("should pass options as direct properties while still exposing positional args and name() to the action handler (regression test for issue #20)", function () {
    const actionSpy = sinon.spy();
    const mockFs = sinon.mock(fs);
    mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/some/package.json")
      .returns(JSON.stringify({ version: "1.2.3" }));
    mockFs
      .expects("readFileSync")
      .once()
      .withExactArgs("/some/conf/commands.json")
      .returns(
        JSON.stringify({
          commands: {
            greet: {
              desc: "Greet command",
              options: [{ arg: "-f, --flag", desc: "Flag description" }],
            },
          },
        }),
      );
    sinon
      .stub(process, "argv")
      .value(["node", "cli.js", "greet", "Ada", "--flag"]);
    bag.command("/some/dir", {
      commands: {
        greet: { action: actionSpy },
      },
    });
    referee.assert.equals(actionSpy.callCount, 1);
    const calledWith = actionSpy.firstCall.args[0];
    // Flag must now surface as a direct property,
    // while positional args and the command name - only reachable via the Command
    // instance, since bagofcli never registers positional args with commander -
    // must still be available too.
    referee.assert.isTrue(calledWith.flag);
    referee.assert.equals(calledWith.args, ["Ada"]);
    referee.assert.equals(calledWith.name(), "greet");
  });
});
