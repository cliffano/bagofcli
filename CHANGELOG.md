# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased
### Changed
- Replace buster-istanbul with c8 for test coverage
- Replace prompt with inquirer for input prompt

## 2.0.2 - 2020-06-07
### Fixed
- Fixed missing extension on package.json main property
- Fixed commander arguments handling in version 5.1.0

## 2.0.1 - 2020-05-22
### Fixed
- Fixed rules validation check

## 2.0.0 - 2020-05-13
### Changed
- Changed module to be ESM
- Replace Buster with Mocha for unit tests
- Replace Travis CI with GitHub Actions

### Removed
- Remove sub-dependency to Contextify (no more node-gyp errors)

## 1.1.0 - 2018-02-14
### Added
- Add execAndCollect function

## 1.0.0 - 2016-10-13
### Changed
- Upgrade deps to latest

## 0.2.5 - 2016-08-14
### Changed
- Use safe colors
- Set min node engine to v4.0.0

## 0.2.3 - 2015-07-12
### Added
- Add lookupConfig function

## 0.2.2 - 2015-06-21
### Added
- Add build reports to readme

## 0.2.1 - 2014-11-09
### Added
- Add command option validation
- Add global option validation

## 0.2.0 - 2014-09-08
### Changed
- Set min node engine to v0.10.0

## 0.1.0 - 2014-08-31
### Changed
- Replace validation package from validator to iz

## 0.0.10 - 2014-08-28
### Added
- Add invalid argument rule check

## 0.0.9 - 2014-06-27
### Changed
- Update documentation, upgrade dependencies
- Change test lib to buster-node + referee
- Set min node engine to v0.8.0

## 0.0.6 - 2013-10-13
### Added
- Add files function

## 0.0.5 - 2013-07-15
### Added
- Add optional arg support for usage display

## 0.0.4 - 2013-07-09

## 0.0.3 - 2013-07-08
### Added
- Add command arguments validation support
- Add help examples support

### Changed
- Change exec to display stdout and stderr in chunks
- Display help when command is unspecified
- Display error message when command is unknown

## 0.0.2 - 2013-06-20
### Changed
- Colourise success and error output

## 0.0.1 - 2013-06-01
### Added
- Initial version, extracted from cliffano/bagofholding
