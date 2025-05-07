/* eslint-disable camelcase */
import Dockerode, { Container, ContainerCreateOptions } from 'dockerode'

import { ContainerImageConflictError } from './error.js'
import { Logging } from './logging.js'

export const DEFAULT_ENV_PREFIX = 'codex-factory'
export const DEFAULT_IMAGE_PREFIX = 'nim-codex'
export const HOST_COUNT = 4

const BLOCKCHAIN_IMAGE_NAME_SUFFIX = '-blockchain'
const CLIENT_IMAGE_NAME_SUFFIX = '-client'
const HOST_IMAGE_NAME_SUFFIX = '-host'
const NETWORK_NAME_SUFFIX = '-network'
const HARDHAT_ACCOUNTS = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Deployer account
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Client account
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Host 1 account
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Host 2 account
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // .
  '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', // .
  '0x976EA74026E726554dB657fA54763abd0C3a0aa9', // .
  '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
  '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
  '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
  '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
  '0x71bE63f3384f5fb98995898A86B02Fb2426c5788',
  '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a',
  '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec',
  '0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097',
  '0xcd3B766CCDd6AE721141F452C550Ca635964ce71',
  '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
  '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E',
  '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
  '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
]

export const BLOCKCHAIN_IMAGE_LABEL_KEY = 'storage.codex.nim-codex.blockchain-image'

export interface RunOptions {
  fresh: boolean
}

export enum ContainerType {
  BLOCKCHAIN = 'blockchain',
  CLIENT = 'client',
  HOST = 'host',
  HOST_2 = 'host2',
  HOST_3 = 'host3',
  HOST_4 = 'host4',
}

export type Status = 'exists' | 'not-found' | 'running'
type FindResult = { container?: Container; image?: string }

export interface AllStatus {
  blockchain: Status
  client: Status
  host: Status
  host_2: Status
  host_3: Status
  host_4: Status
}

export interface DockerError extends Error {
  reason: string
  statusCode: number
}

export class Docker {
  private console: Logging
  private docker: Dockerode
  private envPrefix: string
  private imagePrefix: string
  private repo?: string
  private runningContainers: Container[]

  constructor(console: Logging, envPrefix: string, imagePrefix: string, repo?: string) {
    this.docker = new Dockerode()
    this.console = console
    this.runningContainers = []
    this.envPrefix = envPrefix
    this.imagePrefix = imagePrefix
    this.repo = repo
  }

  private get blockchainName() {
    return `${this.envPrefix}${BLOCKCHAIN_IMAGE_NAME_SUFFIX}`
  }

  private get clientName() {
    return `${this.envPrefix}${CLIENT_IMAGE_NAME_SUFFIX}`
  }

  private get networkName() {
    return `${this.envPrefix}${NETWORK_NAME_SUFFIX}`
  }

  public async createNetwork(): Promise<void> {
    const networks = await this.docker.listNetworks({ filters: { name: [this.networkName] } })

    if (networks.length === 0) {
      await this.docker.createNetwork({ Name: this.networkName })
    }
  }

  public async getAllStatus(): Promise<AllStatus> {
    return {
      blockchain: await this.getStatusForContainer(ContainerType.BLOCKCHAIN),
      client: await this.getStatusForContainer(ContainerType.CLIENT),
      host: await this.getStatusForContainer(ContainerType.HOST),
      host_2: await this.getStatusForContainer(ContainerType.HOST_2),
      host_3: await this.getStatusForContainer(ContainerType.HOST_3),
      host_4: await this.getStatusForContainer(ContainerType.HOST_4),
    }
  }

  public async getBlockchainImage(codexVersion: string): Promise<string> {
    // Lets pull the Codex's image if it is not present
    await this.pullImageIfNotFound(this.codexImage(codexVersion))

    const codexImageMeta = await this.docker.getImage(this.codexImage(codexVersion)).inspect()
    const blockchainImage = codexImageMeta.Config.Labels[BLOCKCHAIN_IMAGE_LABEL_KEY]

    if (!blockchainImage) {
      throw new Error('Blockchain image version was not found in given Codex image labels!')
    }

    return blockchainImage
  }

  public async getStatusForContainer(name: ContainerType): Promise<Status> {
    const foundContainer = await this.findContainer(this.getContainerName(name))

    if (!foundContainer.container) {
      return 'not-found'
    }

    const inspectStatus = await foundContainer.container.inspect()

    if (inspectStatus.State.Running) {
      return 'running'
    }

    return 'exists'
  }

  public async logs(
    target: ContainerType,
    outputStream: NodeJS.WriteStream,
    follow = false,
    tail?: number,
  ): Promise<void> {
    const { container } = await this.findContainer(this.getContainerName(target))

    if (!container) {
      throw new Error('Client container does not exists, even though it should have had!')
    }

    // @ts-expect-error: Follow is not in typings
    const logs = await container.logs({ follow, stderr: true, stdout: true, tail })

    if (follow) {
      // @ts-expect-error: Pipe not defined
      logs.pipe(outputStream)
    } else {
      outputStream.write(logs as unknown as Buffer)
    }
  }

  public async startBlockchainNode(blockchainImage: string, options: RunOptions): Promise<void> {
    if (options.fresh) await this.removeContainer(this.blockchainName)
    await this.pullImageIfNotFound(blockchainImage)

    const container = await this.findOrCreateContainer(this.blockchainName, {
      AttachStderr: false,
      AttachStdout: false,
      ExposedPorts: {
        '8545/tcp': {},
      },
      HostConfig: {
        NetworkMode: this.networkName,
        PortBindings: { '8545/tcp': [{ HostPort: '8545' }] },
      },
      Image: blockchainImage,
      name: this.blockchainName,
    })

    this.runningContainers.push(container)
    const state = await container.inspect()

    // If it is already running (because of whatever reason) we are not spawning new node
    if (state.State.Running) {
      this.console.info('The blockchain container was already running, so not starting it again.')
    } else {
      await container.start()
    }
  }

  public async startClientNode(codexVersion: string, options: RunOptions): Promise<void> {
    if (options.fresh) await this.removeContainer(this.clientName)
    await this.pullImageIfNotFound(this.codexImage(codexVersion))

    const container = await this.findOrCreateContainer(this.clientName, {
      AttachStderr: false,
      AttachStdout: false,
      Cmd: ['codex', 'persistence'],
      Env: this.createCodexEnvParameters(HARDHAT_ACCOUNTS[1], 0),
      ExposedPorts: {
        '8070/tcp': {},
        '8080/tcp': {},
        '8090/udp': {},
      },
      HostConfig: {
        NetworkMode: this.networkName,
        PortBindings: {
          '8070/tcp': [{ HostPort: '8070' }],
          '8080/tcp': [{ HostPort: '8080' }],
          '8090/udp': [{ HostPort: '8090' }],
        },
      },
      Image: this.codexImage(codexVersion),
      name: this.clientName,
      Tty: true,
    })

    this.runningContainers.push(container)
    const state = await container.inspect()

    // If it is already running (because of whatever reason) we are not spawning new node.
    // Already in `findOrCreateContainer` the container is verified that it was spawned with expected version.
    if (state.State.Running) {
      this.console.info('The Client node container was already running, so not starting it again.')
    } else {
      await container.start()
    }
  }

  public async startHostNode(
    codexVersion: string,
    hostNumber: number,
    bootstrapAddress: string,
    options: RunOptions,
  ): Promise<void> {
    if (options.fresh) await this.removeContainer(this.hostName(hostNumber))
    await this.pullImageIfNotFound(this.codexImage(codexVersion))

    const container = await this.findOrCreateContainer(this.hostName(hostNumber), {
      AttachStderr: false,
      AttachStdout: false,
      Cmd: ['codex', 'persistence', 'prover'],
      Env: this.createCodexEnvParameters(HARDHAT_ACCOUNTS[hostNumber + 1], hostNumber, bootstrapAddress),
      ExposedPorts: {
        [`${8070 + hostNumber}/tcp`]: {},
        [`${8080 + hostNumber}/tcp`]: {},
        [`${8090 + hostNumber}/udp`]: {},
      },
      HostConfig: {
        NetworkMode: this.networkName,
        PortBindings: {
          [`${8070 + hostNumber}/tcp`]: [{ HostPort: (8070 + hostNumber).toString() }],
          [`${8080 + hostNumber}/tcp`]: [{ HostPort: (8080 + hostNumber).toString() }],
          [`${8090 + hostNumber}/udp`]: [{ HostPort: (8090 + hostNumber).toString() }],
        },
      },
      Image: this.codexImage(codexVersion),
      name: this.hostName(hostNumber),
    })

    this.runningContainers.push(container)
    const state = await container.inspect()

    // If it is already running (because of whatever reason) we are not spawning new node
    if (state.State.Running) {
      this.console.info('The client node container was already running, so not starting it again.')
    } else {
      await container.start()
    }
  }

  public async stopAll(allWithPrefix = false, deleteContainers = false): Promise<void> {
    const containerProcessor = async (container: Container) => {
      try {
        await container.stop()
      } catch (error) {
        // We ignore 304 that represents that the container is already stopped
        if ((error as DockerError).statusCode !== 304) {
          throw error
        }
      }

      if (deleteContainers) {
        await container.remove()
      }
    }

    this.console.info('Stopping all containers')
    await Promise.all(this.runningContainers.map((element) => containerProcessor(element)))

    if (allWithPrefix) {
      const containers = await this.docker.listContainers({ all: true })
      await Promise.all(
        containers
          .filter(container => container.Names.some(n => n.startsWith('/' + this.envPrefix)))
          .map(container => this.docker.getContainer(container.Id))
          .map((element) => containerProcessor(element)),
      )
    }
  }

  private codexImage(codexVersion: string) {
    if (!this.repo) throw new TypeError('Repo has to be defined!')

    return `${this.repo}/${this.imagePrefix}:${codexVersion}`
  }

  private createCodexEnvParameters(ethAccount: string, portIndex: number, bootnode?: string): string[] {
    const options: Record<string, string> = {
      'api-bindaddr': '0.0.0.0',
      'api-cors-origin': '*',
      'api-port': `${8080 + portIndex}`,
      'disc-port': `${8090 + portIndex}`,
      'eth-account': ethAccount,
      'eth-provider': `http://${this.blockchainName}:8545`,
      'listen-addrs': `/ip4/0.0.0.0/tcp/${8070 + portIndex}`,
      'log-level': 'NOTICE; TRACE: marketplace,sales,node,restapi',
      'marketplace-address': '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44',
      validator: 'true',
      'validator-max-slots': '1000',
    }

    // Env variables for Codex has form of `CODEX_LOG_LEVEL`, so we need to transform it.
    // eslint-disable-next-line unicorn/no-array-reduce
    const envVariables = Object.entries(options).reduce<string[]>((previous, current) => {
      const keyName = `CODEX_${current[0].toUpperCase().replaceAll('-', '_')}`
      previous.push(`${keyName}=${current[1]}`)

      return previous
    }, [])

    if (bootnode) {
      envVariables.push(`BOOTSTRAP_NODE_URL=${bootnode}:8080`)
    }

    envVariables.push('NAT_IP_AUTO=true')

    return envVariables
  }

  private async findContainer(name: string): Promise<FindResult> {
    const containers = await this.docker.listContainers({ all: true, filters: { name: [name] } })

    if (containers.length === 0) {
      return {}
    }

    if (containers.length > 1) {
      throw new Error(`Found ${containers.length} containers for name "${name}". Expected only one.`)
    }

    return { container: this.docker.getContainer(containers[0].Id), image: containers[0].Image }
  }

  private async findOrCreateContainer(name: string, createOptions: ContainerCreateOptions): Promise<Container> {
    const { container, image: foundImage } = await this.findContainer(name)

    if (container) {
      this.console.info(`Container with name "${name}" found. Using it.`)

      if (foundImage !== createOptions.Image) {
        throw new ContainerImageConflictError(
          `Container with name "${name}" found but it was created with different image or image version then expected!`,
          foundImage!,
          createOptions.Image!,
        )
      }

      return container
    }

    this.console.info(`Container with name "${name}" not found. Creating new one.`)

    try {
      return await this.docker.createContainer(createOptions)
    } catch (error) {
      // 404 is Image Not Found ==> pull the image
      if ((error as DockerError).statusCode !== 404) {
        throw error
      }

      this.console.info(`Image ${createOptions.Image} not found. Pulling it.`)
      await this.pullImageIfNotFound(createOptions.Image!)

      return this.docker.createContainer(createOptions)
    }
  }

  private getContainerName(name: ContainerType) {
    switch (name) {
      case ContainerType.BLOCKCHAIN: {
        return this.blockchainName
      }

      case ContainerType.CLIENT: {
        return this.clientName
      }

      case ContainerType.HOST: {
        return this.hostName(1)
      }

      case ContainerType.HOST_2: {
        return this.hostName(2)
      }

      case ContainerType.HOST_3: {
        return this.hostName(3)
      }

      case ContainerType.HOST_4: {
        return this.hostName(4)
      }

      default: {
        throw new Error('Unknown container!')
      }
    }
  }

  private hostName(index: number) {
    return `${this.envPrefix}${HOST_IMAGE_NAME_SUFFIX}-${index}`
  }

  private async pullImageIfNotFound(name: string): Promise<void> {
    try {
      await this.docker.getImage(name).inspect()
    } catch {
      this.console.info(`Image ${name} not found locally, pulling it.`)
      const pullStream = await this.docker.pull(name)

      await new Promise(res => {this.docker.modem.followProgress(pullStream, res)})
    }
  }

  private async removeContainer(name: string): Promise<void> {
    this.console.info(`Removing container with name "${name}"`)
    const { container } = await this.findContainer(name)

    // Container does not exist so nothing to delete
    if (!container) {
      return
    }

    await container.remove({ force: true, v: true })
  }
}
