<img align="right" src="https://raw.github.com/cliffano/bagofcli/master/avatar.jpg" alt="Avatar"/>

[![Build Status](https://img.shields.io/travis/cliffano/bagofcli.svg)](http://travis-ci.org/cliffano/bagofcli)
[![Dependencies Status](https://img.shields.io/david/cliffano/bagofcli.svg)](http://david-dm.org/cliffano/bagofcli)
[![Coverage Status](https://img.shields.io/coveralls/cliffano/bagofcli.svg)](https://coveralls.io/r/cliffano/bagofcli?branch=master)
[![Published Version](https://img.shields.io/npm/v/bagofcli.svg)](http://www.npmjs.com/package/bagofcli)
<br/>
[![npm Badge](https://nodei.co/npm/bagofcli.png)](http://npmjs.org/package/bagofcli)

Bag Of CLI
----------

Bag Of CLI contains CLI utility functions.

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

[Developer's Guide](http://cliffano.github.io/developers_guide.html#nodejs)

Build reports:

* [Code complexity report](http://cliffano.github.io/bagofcli/complexity/plato/index.html)
* [Unit tests report](http://cliffano.github.io/bagofcli/test/buster.out)
* [Test coverage report](http://cliffano.github.io/bagofcli/coverage/buster-istanbul/lcov-report/lib/index.html)
* [API Documentation](http://cliffano.github.io/bagofcli/doc/dox-foundation/index.html)
