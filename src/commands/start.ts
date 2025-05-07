import { Args, Flags } from "@oclif/core";
import { OutputFlags } from "@oclif/core/interfaces";
import ora from "ora";

import { BaseCommand } from "../base.js";
import { findCodexVersion, validateVersion } from "../utils/config-sources.js";
import {
  ContainerType,
  DEFAULT_ENV_PREFIX,
  DEFAULT_IMAGE_PREFIX,
  Docker,
  HOST_COUNT,
  RunOptions,
} from "../utils/docker.js";
import { VerbosityLevel } from "../utils/logging.js";
import { waitForBlockchain, waitForClient, waitForHosts } from "../utils/wait.js";

const DEFAULT_REPO = "codexstorage";

export const ENV_ENV_PREFIX_KEY = "FACTORY_ENV_PREFIX";
const ENV_IMAGE_PREFIX_KEY = "FACTORY_IMAGE_PREFIX";
const ENV_REPO_KEY = "FACTORY_DOCKER_REPO";
const ENV_DETACH_KEY = "FACTORY_DETACH";
const ENV_HOSTS_KEY = "FACTORY_HOSTS";
const ENV_FRESH_KEY = "FACTORY_FRESH";

export default class Start extends BaseCommand<typeof Start> {
  static override args = {
    codexVersion: Args.string({ description: "Codex image version", required: false }),
  };
  static override description = "Spin up the Codex Factory cluster";
  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> 0.2.0",
    "<%= config.bin %> <%= command.id %> latest",
  ];
  static override flags = {
    detach: Flags.boolean({
      char: "d",
      default: false,
      description: "Spin up the cluster and exit. No logging is outputted.",
      env: ENV_DETACH_KEY,
    }),
    envPrefix: Flags.string({
      default: DEFAULT_ENV_PREFIX,
      description: "Docker container's names prefix",
      env: ENV_ENV_PREFIX_KEY,
    }),
    fresh: Flags.boolean({
      char: "f",
      default: false,
      description: "The cluster data will be purged before start.",
      env: ENV_FRESH_KEY,
    }),
    hosts: Flags.integer({
      char: "h",
      default: HOST_COUNT,
      description: `Number of hosts to spin. Value between 0 and ${HOST_COUNT} including.`,
      env: ENV_HOSTS_KEY,
    }),
    imagePrefix: Flags.string({
      default: DEFAULT_IMAGE_PREFIX,
      description: "Docker image name prefix",
      env: ENV_IMAGE_PREFIX_KEY,
    }),
    repo: Flags.string({
      default: DEFAULT_REPO,
      description: "Docker repo where images are published",
      env: ENV_REPO_KEY,
    }),


  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Start);

    if (flags.hosts < 0 || flags.hosts > HOST_COUNT) {
      throw new Error(`Worker count has to be between 0 and ${HOST_COUNT} including.`)
    }

    if (!args.codexVersion) {
      args.codexVersion = await findCodexVersion()
      this.console.log('Codex version not specified. Found it configured externally.')
      this.console.log(`Spinning up cluster with Codex version ${args.codexVersion}.`)
    }

    args.codexVersion = validateVersion(args.codexVersion, this.config.pjson)

    const dockerOptions = await this.buildDockerOptions(flags)
    const docker = new Docker(this.console, flags.envPrefix, flags.imagePrefix, flags.repo)
    const status = await docker.getAllStatus()

    if (Object.values(status).every(st => st === 'running')) {
      this.console.log('All containers are up and running')

      if (flags.detach) {
        return
      }

      await docker.logs(ContainerType.CLIENT, process.stdout)
    }

    let clientDockerIpAddress: string

    process.on('SIGINT', async () => {
      try {
        await docker.stopAll(false)
      } catch (error) {
        this.console.error(`Error: ${error}`)
      }

      // eslint-disable-next-line n/no-process-exit
      process.exit()
    })

    const networkSpinner = ora({
      color: 'yellow',
      isSilent: this.verbosity === VerbosityLevel.Quiet,
      spinner: 'point',
      text: 'Spawning network...',
    }).start()

    try {
      await docker.createNetwork()
      networkSpinner.succeed('Network is up')
    } catch (error) {
      networkSpinner.fail(`It was not possible to spawn network!`)
      throw error
    }

    const blockchainSpinner = ora({
      color: 'yellow',
      isSilent: this.verbosity === VerbosityLevel.Quiet,
      spinner: 'point',
      text: 'Getting blockchain image version...',
    }).start()

    try {
      const blockchainImage = await docker.getBlockchainImage(args.codexVersion)

      blockchainSpinner.text = 'Starting blockchain node...'
      await docker.startBlockchainNode(blockchainImage, dockerOptions)
      blockchainSpinner.text = 'Waiting until blockchain is ready...'
      await waitForBlockchain()
      blockchainSpinner.succeed('Blockchain node is up and listening')
    } catch (error) {
      blockchainSpinner.fail(`It was not possible to start blockchain node!`)
      await this.stopDocker(docker)
      throw error
    }

    const clientSpinner = ora({
      color: 'yellow',
      isSilent: this.verbosity === VerbosityLevel.Quiet,
      spinner: 'point',
      text: 'Starting Codex client node...',
    }).start()

    async function clientStatus(): Promise<boolean> {
      return (await docker.getStatusForContainer(ContainerType.CLIENT)) === 'running'
    }

    try {
      await docker.startClientNode(args.codexVersion, dockerOptions)
      clientSpinner.text = 'Waiting until client node is ready...'
      clientDockerIpAddress = await waitForClient(clientStatus)
      clientSpinner.succeed('Client boot node is up and listening')
    } catch (error) {
      clientSpinner.fail(`It was not possible to start client node!`)
      await this.stopDocker(docker)
      throw error
    }

    if (flags.hosts > 0) {
      const hostSpinner = ora({
        color: 'yellow',
        isSilent: this.verbosity === VerbosityLevel.Quiet,
        spinner: 'point',
        text: 'Starting Codex host nodes...',
      }).start()

      try {
        for (let i = 1; i <= flags.hosts; i++) {
          // eslint-disable-next-line no-await-in-loop
          await docker.startHostNode(args.codexVersion, i, clientDockerIpAddress, dockerOptions)
        }

        hostSpinner.text = 'Waiting until all host nodes connect to client...'
        await waitForHosts(flags.hosts, docker.getAllStatus.bind(docker))
        hostSpinner.succeed('Host nodes are up and listening')
      } catch (error) {
        hostSpinner.fail(`It was not possible to start host nodes!`)
        await this.stopDocker(docker)
        throw error
      }
    }

    if (!flags.detach) {
      await docker.logs(ContainerType.CLIENT, process.stdout, true)
    }
  }

  private async buildDockerOptions(flags: OutputFlags<typeof Start.flags>): Promise<RunOptions> {
    return {
      fresh: flags.fresh,
    }
  }

  private async stopDocker(docker: Docker) {
    const dockerSpinner = ora({
      color: 'red',
      isSilent: this.verbosity === VerbosityLevel.Quiet,
      spinner: 'point',
      text: 'Stopping all containers...',
    }).start()

    await docker.stopAll(false)

    dockerSpinner.stop()
  }
}
