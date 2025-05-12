import { Codex } from '@codex-storage/sdk-js'
import { runCommand as runCommandRaw } from '@oclif/test'
import { use as chaiUse, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import Dockerode from 'dockerode'
import { randomBytes } from 'node:crypto'

import { ENV_ENV_PREFIX_KEY } from '../../src/commands/start'
import { DockerError } from '../../src/utils/docker'
import { deleteNetwork, findContainer } from '../utils/docker'

chaiUse(chaiAsPromised)
let testFailed = false

async function runCommand (args: string): Promise<ReturnType<typeof runCommandRaw>> {
  const result = await runCommandRaw(args)

  if (result.error) {
    console.log('============\n=> ERROR:', result.error)
    console.log('============\n=> STDOUT:', result.stdout)
    console.error('============\n=> STDERR:', result.stderr)
  }

  return result
}

function wrapper (fn: () => Promise<unknown>): () => Promise<unknown> {
  return async () => {
    try {
      const result = await fn()
      testFailed = false

      return result
    } catch (error) {
      testFailed = true
      throw error
    }
  }
}

process.on('SIGINT', async () => {
  try {
    console.log('SIGINT received, stopping the cluster')

    if (process.env[ENV_ENV_PREFIX_KEY]) {
      console.log('Cleaning up containers')
      await runCommand('stop --rm') // Cleanup the testing containers
    }
  } catch (error) {
    console.error(`Error: ${error}`)
  }

  // eslint-disable-next-line n/no-process-exit
  process.exit()
})

describe('start command', () => {
  let docker: Dockerode
  let codexClient: Codex
  const envPrefix = `codex-factory-test-${randomBytes(4).toString('hex')}`

  before(() => {
    docker = new Dockerode()
    codexClient = new Codex('http://127.0.0.1:8080')

    // This will force Codex Factory to create fresh images
    process.env[ENV_ENV_PREFIX_KEY] = envPrefix
  })

  afterEach(async () => {
    if (testFailed) {
      console.log('List of containers:')
      const containers = await docker.listContainers()
      for (const c of containers) console.log(` - ${c.Names.join(', ')}`)

      const { stdout } = await runCommand('logs client')
      console.log('Client logs:\n', stdout)

    }

    await runCommand('stop')
  })

  after(async () => {
    await runCommand('stop --rm') // Cleanup the testing containers
    await deleteNetwork(docker, `${envPrefix}-network`)
  })

  it(
    'should start cluster',
    wrapper(async () => {
      // As spinning the cluster with --detach the command will exit once the cluster is up and running
      await runCommand('start --detach')

      await expect(findContainer(docker, 'client')).to.eventually.be.not.undefined
      await expect(findContainer(docker, 'blockchain')).to.eventually.be.not.undefined
      await expect(findContainer(docker, 'host-1')).to.eventually.be.not.undefined
      await expect(findContainer(docker, 'host-2')).to.eventually.be.not.undefined
      await expect(findContainer(docker, 'host-3')).to.eventually.be.not.undefined
      await expect(findContainer(docker, 'host-4')).to.eventually.be.not.undefined

      expect((await codexClient.debug.info()).data).to.have.property('id')
    })
  )

  describe('should start cluster with just few hosts', () => {
    before(async () => {
      await runCommand('stop --rm') // Cleanup the testing containers
    })

    it(
      'test',
      wrapper(async () => {
        // As spinning the cluster with --detach the command will exit once the cluster is up and running
        await runCommand('start --hosts 2')

        await expect(findContainer(docker, 'client')).to.eventually.be.not.undefined
        await expect(findContainer(docker, 'blockchain')).to.eventually.be.not.undefined
        await expect(findContainer(docker, 'host-1')).to.eventually.be.not.undefined
        await expect(findContainer(docker, 'host-2')).to.eventually.be.not.undefined
        await expect(findContainer(docker, 'host-3')).to.be.rejected
        await expect(findContainer(docker, 'host-4')).to.be.rejected

        expect((await codexClient.debug.info()).data).to.have.property('id')
      })
    )
  })

  describe('should create docker network', () => {
    before(async () => {
      await runCommand('stop --rm') // Cleanup the testing containers

      try {
        // Make sure the network does not exists
        await (await docker.getNetwork(`${envPrefix}-network`)).remove()
      } catch (error) {
        if ((error as DockerError).statusCode !== 404) {
          throw error
        }
      }
    })

    it(
      'test',
      wrapper(async () => {
        await runCommand('start --detach')


        expect(docker.getNetwork(`${envPrefix}-network`)).to.be.not.undefined
      })
    )
  })

  describe('should remove containers with --fresh option', () => {
    let availabilityId: string

    before(async () => {
      console.log('(before) Starting up Codex Factory')
      await runCommand('start --detach')
      const result = await codexClient.marketplace.createAvailability({
        duration: 100,
        minPricePerBytePerSecond: 100,
        totalCollateral: 1,
        totalSize: 3000
      })

      if (result.error) {
        throw result.data
      }

      availabilityId = result.data.id

      console.log('(before) Stopping the Codex Factory')
      await runCommand('stop') // Cleanup the testing containers
    })

    it(
      'test',
      wrapper(async () => {
        console.log('(test) Starting the Codex Factory')
        await runCommand('start --fresh --detach')

        console.log('(test) Trying to fetch the data')
        const availabilities = await codexClient.marketplace.availabilities()

        if (availabilities.error) {
          throw availabilities.data
        }

        if (availabilities.data.some(({ id }) => id === availabilityId)) {
          throw new Error('Availability was not removed!')
        }
      })
    )
  })
})
