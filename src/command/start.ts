import { Argument, LeafCommand, Option } from 'furious-commander'
import { RootCommand } from './root-command'
import {
  ContainerType,
  DEFAULT_ENV_PREFIX,
  DEFAULT_IMAGE_PREFIX,
  Docker,
  RunOptions,
  HOST_COUNT,
} from '../utils/docker'
import { waitForBlockchain, waitForClient, waitForHosts } from '../utils/wait'
import ora from 'ora'
import { VerbosityLevel } from './root-command/logging'
import { findCodexVersion, validateVersion } from '../utils/config-sources'

const DEFAULT_REPO = 'codexstorage'

export const ENV_ENV_PREFIX_KEY = 'FACTORY_ENV_PREFIX'
const ENV_IMAGE_PREFIX_KEY = 'FACTORY_IMAGE_PREFIX'
const ENV_REPO_KEY = 'FACTORY_DOCKER_REPO'
const ENV_DETACH_KEY = 'FACTORY_DETACH'
const ENV_HOSTS_KEY = 'FACTORY_HOSTS'
const ENV_FRESH_KEY = 'FACTORY_FRESH'

export class Start extends RootCommand implements LeafCommand {
  public readonly name = 'start'

  public readonly description = 'Spin up the Codex Factory cluster'

  @Option({
    key: 'fresh',
    alias: 'f',
    type: 'boolean',
    description: 'The cluster data will be purged before start',
    envKey: ENV_FRESH_KEY,
    default: false,
  })
  public fresh!: boolean

  @Option({
    key: 'detach',
    alias: 'd',
    type: 'boolean',
    description: 'Spin up the cluster and exit. No logging is outputted.',
    envKey: ENV_DETACH_KEY,
    default: false,
  })
  public detach!: boolean

  @Option({
    key: 'hosts',
    alias: 'h',
    type: 'number',
    description: `Number of hosts to spin. Value between 0 and ${HOST_COUNT} including.`,
    envKey: ENV_HOSTS_KEY,
    default: HOST_COUNT,
  })
  public hosts!: number

  @Option({
    key: 'repo',
    type: 'string',
    description: 'Docker repo',
    envKey: ENV_REPO_KEY,
    default: DEFAULT_REPO,
  })
  public repo!: string

  @Option({
    key: 'image-prefix',
    type: 'string',
    description: 'Docker image name prefix',
    envKey: ENV_IMAGE_PREFIX_KEY,
    default: DEFAULT_IMAGE_PREFIX,
  })
  public imagePrefix!: string

  @Option({
    key: 'env-prefix',
    type: 'string',
    description: "Docker container's names prefix",
    envKey: ENV_ENV_PREFIX_KEY,
    default: DEFAULT_ENV_PREFIX,
  })
  public envPrefix!: string

  @Argument({ key: 'codex-version', description: 'Codex image version', required: false })
  public codexVersion!: string

  public async run(): Promise<void> {
    await super.init()

    if (this.hosts < 0 || this.hosts > HOST_COUNT) {
      throw new Error(`Worker count has to be between 0 and ${HOST_COUNT} including.`)
    }

    if (!this.codexVersion) {
      this.codexVersion = await findCodexVersion()
      this.console.log('Codex version not specified. Found it configured externally.')
      this.console.log(`Spinning up cluster with Codex version ${this.codexVersion}.`)
    }

    this.codexVersion = validateVersion(this.codexVersion)

    const dockerOptions = await this.buildDockerOptions()
    const docker = new Docker(this.console, this.envPrefix, this.imagePrefix, this.repo)
    const status = await docker.getAllStatus()

    if (Object.values(status).every(st => st === 'running')) {
      this.console.log('All containers are up and running')

      if (this.detach) {
        return
      }

      await docker.logs(ContainerType.CLIENT, process.stdout)
    }

    let clientDockerIpAddress: string

    process.on('SIGINT', async () => {
      try {
        await docker.stopAll(false)
      } catch (e) {
        this.console.error(`Error: ${e}`)
      }

      process.exit()
    })

    const networkSpinner = ora({
      text: 'Spawning network...',
      spinner: 'point',
      color: 'yellow',
      isSilent: this.verbosity === VerbosityLevel.Quiet,
    }).start()

    try {
      await docker.createNetwork()
      networkSpinner.succeed('Network is up')
    } catch (e) {
      networkSpinner.fail(`It was not possible to spawn network!`)
      throw e
    }

    const blockchainSpinner = ora({
      text: 'Getting blockchain image version...',
      spinner: 'point',
      color: 'yellow',
      isSilent: this.verbosity === VerbosityLevel.Quiet,
    }).start()

    try {
      const blockchainImage = await docker.getBlockchainImage(this.codexVersion)

      blockchainSpinner.text = 'Starting blockchain node...'
      await docker.startBlockchainNode(blockchainImage, dockerOptions)
      blockchainSpinner.text = 'Waiting until blockchain is ready...'
      await waitForBlockchain()
      blockchainSpinner.succeed('Blockchain node is up and listening')
    } catch (e) {
      blockchainSpinner.fail(`It was not possible to start blockchain node!`)
      await this.stopDocker(docker)
      throw e
    }

    const clientSpinner = ora({
      text: 'Starting Codex client node...',
      spinner: 'point',
      color: 'yellow',
      isSilent: this.verbosity === VerbosityLevel.Quiet,
    }).start()

    async function clientStatus(): Promise<boolean> {
      return (await docker.getStatusForContainer(ContainerType.CLIENT)) === 'running'
    }

    try {
      await docker.startClientNode(this.codexVersion, dockerOptions)
      clientSpinner.text = 'Waiting until client node is ready...'
      clientDockerIpAddress = await waitForClient(clientStatus)
      clientSpinner.succeed('Client boot node is up and listening')
    } catch (e) {
      clientSpinner.fail(`It was not possible to start client node!`)
      await this.stopDocker(docker)
      throw e
    }

    if (this.hosts > 0) {
      const hostSpinner = ora({
        text: 'Starting Codex host nodes...',
        spinner: 'point',
        color: 'yellow',
        isSilent: this.verbosity === VerbosityLevel.Quiet,
      }).start()

      try {
        for (let i = 1; i <= this.hosts; i++) {
          await docker.startHostNode(this.codexVersion, i, clientDockerIpAddress, dockerOptions)
        }

        hostSpinner.text = 'Waiting until all host nodes connect to client...'
        await waitForHosts(this.hosts, docker.getAllStatus.bind(docker))
        hostSpinner.succeed('Host nodes are up and listening')
      } catch (e) {
        hostSpinner.fail(`It was not possible to start host nodes!`)
        await this.stopDocker(docker)
        throw e
      }
    }

    if (!this.detach) {
      await docker.logs(ContainerType.CLIENT, process.stdout, true)
    }
  }

  private async stopDocker(docker: Docker) {
    const dockerSpinner = ora({
      text: 'Stopping all containers...',
      spinner: 'point',
      color: 'red',
      isSilent: this.verbosity === VerbosityLevel.Quiet,
    }).start()

    await docker.stopAll(false)

    dockerSpinner.stop()
  }

  private async buildDockerOptions(): Promise<RunOptions> {
    return {
      fresh: this.fresh,
    }
  }
}
