# Codex Factory

![render1747145157758-min](https://github.com/user-attachments/assets/0ebb6b42-88fc-4788-9027-a2ecb12eac1a)

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/codex-factory.svg)](https://npmjs.org/package/codex-factory)
[![Downloads/week](https://img.shields.io/npm/dw/codex-factory.svg)](https://npmjs.org/package/codex-factory)
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
$ npm install -g codex-factory
```

You can also use this CLI directly thanks to `npx` without installing it:

```shell
$ npx codex-factory start 0.2.1
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

## What it does

This tool spawns small cluster of Codex nodes using Docker containers. 
It spawns by default 5 nodes: 1 client node and 4 storage provider nodes. The cluster also contains local blockchain container that is running Hardhat instance with deployed Marketplace smart contracts and funds for all the nodes. All the nodes also run validator routine. All nodes run `persistence` module, so this is the most feature complete you can get with Codex.

### Exposed API

The API ports of the nodes are following:

 - `8080` for client node
 - `8081-8084` for the host nodes

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
