# Codex Factory

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@codex-storage/codex-factory.svg)](https://npmjs.org/package/@codex-storage/codex-factory)
[![Downloads/week](https://img.shields.io/npm/dw/@codex-storage/codex-factory.svg)](https://npmjs.org/package/@codex-storage/codex-factory)
[![Tests](https://github.com/codex-storage/codex-factory/actions/workflows/test.yaml/badge.svg)](https://github.com/codex-storage/codex-factory/actions/workflows/test.yaml)
![](https://img.shields.io/badge/npm-%3E%3D10.0.0-orange.svg?style=flat-square)
![](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-orange.svg?style=flat-square)

> CLI tool to spin up Docker cluster of Codex nodes for advanced testing and/or development

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#license)

## Install

**Requirements:** Docker

```shell
$ npm install -g @codex-storage/codex-factory
```

## Usage

```shell
# This spins up the cluster for specific Codex version and exits
$ codex-factory start --detach 0.2.0

# The spins up the cluster using Codex version configured in external places. See below for options where to place it.
$ codex-factory start --detach

# This attaches to the client container and displays its logs
$ codex-factory logs client --follow

# This stops the cluster and keeping the containers so next time they are spinned up the data are kept
# but data are not persisted across version's bump!
$ codex-factory stop

# You can also spin up the cluster without the --detach which then directly
# attaches to the client logs and the cluster is terminated upon SIGINT (Ctrl+C)
$ codex-factory start 0.2.0

# You can spin cluster with the last nim-codex's master build - this might not work!
$ codex-factory start latest

# You can spin cluster with the specific Git commit nim-codex's master build - this might not work!
$ codex-factory start ce2db15
```

For more details see the `--help` page of the CLI and its commands.

### External Codex version configuration

You can omit the Codex version argument when running `codex-factory start` command if you specify it in one of the expected places:

- `CODEX_FACTORY_VERSION` env. variable
- `package.json` placed in current working directory (cwd) under the `engines.codex` property.
- `.codexfactory.json` placed in current working directory (cwd) with property `version`.

#### Build versions

Docker images are built upon every push to `nim-codex`'s `master` branch, so if you need to test some specific commit
you can then use its short Git commit hash in order to spin Codex's factory cluster. But be aware that this might not
work as Codex factory is maintained based on the released versions and hence if there were some changes in configuration
parameters in the build you want to use, Codex factory might not yet support it.

#### Latest versions

There is special Codex Factory image tag `latest` that has the latest Codex's master build.
It is not recommended using this tag unless you need to test some upcoming feature and know what are you doing.
There is high chance that there might be some change in Codex that is not compatible with current Codex Factory and so it might not even work.

## Contribute

There are some ways you can make this module better:

- Consult our [open issues](https://github.com/codex-storage/codex-factory/issues) and take on one of them
- Something not working - create issue!
- See something to tweak - create PR!
- Join us in our [Discord chat](https://discord.gg/codex-storage)  if you have questions or want to give feedback

### Developing

You can run the CLI while developing using `npm start -- <command> ...`.

## Maintainers

- [AuHau](https://github.com/auhau)

## License

[BSD-3-Clause](LICENSE)

Originally written for Swarm's Bee client: https://github.com/ethersphere/bee-factory
