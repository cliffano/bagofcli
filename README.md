<img align="right" src="https://raw.github.com/cliffano/bagofcli/master/avatar.jpg" alt="Avatar"/>

[![Build Status](https://github.com/cliffano/bagofcli/workflows/CI/badge.svg)](https://github.com/cliffano/bagofcli/actions?query=workflow%3ACI)
[![Security Status](https://snyk.io/test/github/cliffano/bagofcli/badge.svg)](https://snyk.io/test/github/cliffano/bagofcli)
[![Dependencies Status](https://img.shields.io/librariesio/release/npm/bagofcli)](https://libraries.io/github/cliffano/bagofcli)
[![Coverage Status](https://img.shields.io/coveralls/cliffano/bagofcli.svg)](https://coveralls.io/r/cliffano/bagofcli?branch=master)
[![Published Version](https://img.shields.io/npm/v/bagofcli.svg)](http://www.npmjs.com/package/bagofcli)
<br/>

Bag Of CLI
----------

Bag Of CLI contains CLI utility functions.

This is handy when you want to have a set of common CLI commands with descriptions, options, help, and example usages, by just defining them in a JSON file. Bag of CLI essentially allows you to define those info in a configuration file instead of code.

Installation
------------

    npm install bagofcli

or as a dependency in package.json file:

    "dependencies": {
      "bagofcli": "x.y.z"
    }

Usage
-----

Commands:

    // create conf/commands.json file containing commands configuration

    {
      "options": [
        { "arg": "-f, --file <file>", "desc": "This is a global option, applicable to all commands." }
      ],
      "commands": {
        "command1": {
          "desc": "This is the first command",
          "options": [
            { "arg": "-r, --registry <registry>", "desc": "This is a command option, applicable only to command1"}
          ],
          "examples": [
            "<bin> command1 --registry someregistry"
          ]
        },
        "command2": {
          "desc": "This is the second command",
          "options": [
            { "arg": "-d, --debug", "desc": "This is a command option, applicable only to command2"}
          ],
          "examples": [
            "<bin> command2 --debug"
          ]
        }
      }
    }

    // setup command handlers

    var bag = require('bagofcli');

    var actions = {
      commands: {
        command1: {
          action: function (args) {
            console.log(args.registry);
          }
        },
        command2: {
          action: function (args) {
            console.log(args.debug);
          }
        }
      }
    };

    bag.command(__dirname, actions);

Check out [lib/bagofcli.js](https://github.com/cliffano/bagofcli/blob/master/lib/bagofcli.js) for more utility functions.

Upgrade
-------

From 0.0.x to 0.1.x .

Update commands.json argument validation rules:

* `notEmpty` to `required`
* `isNumeric` to `number`
* `isEmail` to `email`

Check out [iz](http://npmjs.org/package/iz) for available validation rules.

Colophon
--------

[Developer's Guide](https://cliffano.github.io/developers_guide.html#nodejs)

Build reports:

* [Code complexity report](https://cliffano.github.io/bagofcli/complexity/plato/index.html)
* [Unit tests report](https://cliffano.github.io/bagofcli/test/mocha.txt)
* [Test coverage report](https://cliffano.github.io/bagofcli/coverage/c8/index.html)
* [API Documentation](https://cliffano.github.io/bagofcli/doc/jsdoc/index.html)
