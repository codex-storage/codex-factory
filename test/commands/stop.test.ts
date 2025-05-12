import { runCommand as runCommandRaw } from '@oclif/test'
import { use as chaiUse, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import Dockerode from 'dockerode'
import {randomBytes} from 'node:crypto'

import { ENV_ENV_PREFIX_KEY } from '../../src/commands/start'
import { deleteNetwork, findContainer } from '../utils/docker'

chaiUse(chaiAsPromised)

async function runCommand(args: string): Promise<ReturnType<typeof runCommandRaw>> {
  const result = await runCommandRaw(args)

  if (result.error) {
    console.log('============\n=> ERROR:', result.error)
    console.log('============\n=> STDOUT:', result.stdout)
    console.error('============\n=> STDERR:', result.stderr)
  }

  return result
}

describe('stop command', () => {
  let docker: Dockerode
  const envPrefix = `codex-factory-test-${randomBytes(4).toString('hex')}`

  before(() => {
    docker = new Dockerode()

    // This will force Codex Factory to create fresh images
    process.env[ENV_ENV_PREFIX_KEY] = envPrefix
  })

  after(async () => {
    await runCommand('stop --rm') // Cleanup the testing containers
    await deleteNetwork(docker, `${envPrefix}-network`)
  })

  describe('should stop cluster', () => {
    before(async () => {
      // As spinning the cluster with --detach the command will exit once the cluster is up and running
      await runCommand('start --detach')
    })

    it('test', async () => {
      await expect(findContainer(docker, 'client')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'blockchain')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'host-1')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'host-2')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'host-3')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'host-4')).to.eventually.have.nested.property('State.Status', 'running')

      await runCommand('stop') // Cleanup the testing containers

      await expect(findContainer(docker, 'client')).to.eventually.have.nested.property('State.Status', 'exited')
      await expect(findContainer(docker, 'blockchain')).to.eventually.have.nested.property('State.Status', 'exited')
      await expect(findContainer(docker, 'host-1')).to.eventually.have.nested.property('State.Status', 'exited')
      await expect(findContainer(docker, 'host-2')).to.eventually.have.nested.property('State.Status', 'exited')
      await expect(findContainer(docker, 'host-3')).to.eventually.have.nested.property('State.Status', 'exited')
      await expect(findContainer(docker, 'host-4')).to.eventually.have.nested.property('State.Status', 'exited')
    })
  })

  describe('should stop cluster and remove containers', () => {
    before(async () => {
      // As spinning the cluster with --detach the command will exit once the cluster is up and running
      await runCommand('start --detach')

    })

    it('test', async () => {
      await expect(findContainer(docker, 'client')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'blockchain')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'host-1')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'host-2')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'host-3')).to.eventually.have.nested.property('State.Status', 'running')
      await expect(findContainer(docker, 'host-4')).to.eventually.have.nested.property('State.Status', 'running')

      await runCommand('stop --rm') // Cleanup the testing containers

      await expect(findContainer(docker, 'client')).to.be.rejected
      await expect(findContainer(docker, 'blockchain')).to.be.rejected
      await expect(findContainer(docker, 'host-1')).to.be.rejected
      await expect(findContainer(docker, 'host-2')).to.be.rejected
      await expect(findContainer(docker, 'host-3')).to.be.rejected
      await expect(findContainer(docker, 'host-4')).to.be.rejected
    })
  })
})

process.on('SIGINT', async () => {
  try {
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
