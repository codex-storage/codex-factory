/* eslint-disable no-console */
import Dockerode from 'dockerode'
import crypto from 'crypto'
import { Codex } from '@codex-storage/sdk-js'

import { run } from '../utils/run'
import { ENV_ENV_PREFIX_KEY } from '../../src/command/start'

import { DockerError } from '../../src/utils/docker'
import { findContainer } from '../utils/docker'

let testFailed = false

function wrapper(fn: () => Promise<unknown>): () => Promise<unknown> {
  return async () => {
    try {
      const result = await fn()
      testFailed = false

      return result
    } catch (e) {
      testFailed = true
      throw e
    }
  }
}

describe('start command', () => {
  let docker: Dockerode
  let codexClient: Codex, codexHost: Codex
  const envPrefix = `codex-factory-test-${crypto.randomBytes(4).toString('hex')}`

  beforeAll(() => {
    docker = new Dockerode()
    codexClient = new Codex('http://127.0.0.1:8080')
    codexHost = new Codex('http://127.0.0.1:8081')

    // This will force Codex Factory to create
    process.env[ENV_ENV_PREFIX_KEY] = envPrefix
  })

  afterEach(async () => {
    if (testFailed) {
      console.log('List of containers:')
      const containers = await docker.listContainers()
      containers.forEach(c => console.log(` - ${c.Names.join(', ')}`))

      await run(['logs', 'client'])
    }

    await run(['stop'])
  })

  afterAll(async () => {
    await run(['stop', '--rm']) // Cleanup the testing containers
  })

  it(
    'should start cluster',
    wrapper(async () => {
      // As spinning the cluster with --detach the command will exit once the cluster is up and running
      await run(['start', '--detach'])

      await expect(findContainer(docker, 'client')).resolves.toBeDefined()
      await expect(findContainer(docker, 'blockchain')).resolves.toBeDefined()
      await expect(findContainer(docker, 'host-1')).resolves.toBeDefined()
      await expect(findContainer(docker, 'host-2')).resolves.toBeDefined()
      await expect(findContainer(docker, 'host-3')).resolves.toBeDefined()
      await expect(findContainer(docker, 'host-4')).resolves.toBeDefined()

      expect((await codexClient.debug.info()).data).toHaveProperty('id')
    }),
  )

  describe('should start cluster with just few hosts', () => {
    beforeAll(async () => {
      await run(['stop', '--rm']) // Cleanup the testing containers
    })

    it(
      '',
      wrapper(async () => {
        // As spinning the cluster with --detach the command will exit once the cluster is up and running
        await run(['start', '--hosts', '2'])

        await expect(findContainer(docker, 'client')).resolves.toBeDefined()
        await expect(findContainer(docker, 'blockchain')).resolves.toBeDefined()
        await expect(findContainer(docker, 'host-1')).resolves.toBeDefined()
        await expect(findContainer(docker, 'host-2')).resolves.toBeDefined()
        await expect(findContainer(docker, 'host-3')).rejects.toHaveProperty('statusCode', 404)
        await expect(findContainer(docker, 'host-4')).rejects.toHaveProperty('statusCode', 404)

        expect((await codexClient.debug.info()).data).toHaveProperty('id')
      }),
    )
  })

  describe('should create docker network', () => {
    beforeAll(async () => {
      await run(['stop', '--rm']) // Cleanup the testing containers

      try {
        // Make sure the network does not exists
        await (await docker.getNetwork(`${envPrefix}-network`)).remove()
      } catch (e) {
        if ((e as DockerError).statusCode !== 404) {
          throw e
        }
      }
    })

    it(
      '',
      wrapper(async () => {
        await run(['start', '--detach'])

        expect(docker.getNetwork(`${envPrefix}-network`)).toBeDefined()
      }),
    )
  })

  describe('should remove containers with --fresh option', () => {
    let availabilityId: string

    beforeAll(async () => {
      console.log('(before) Starting up Codex Factory')
      await run(['start', '--detach'])
      const result = await codexClient.marketplace.createAvailability({
        totalCollateral: 1,
        totalSize: 3000,
        minPricePerBytePerSecond: 100,
        duration: 100,
      })

      if (result.error) {
        throw result.data
      }

      availabilityId = result.data.id

      console.log('(before) Stopping the Codex Factory')
      await run(['stop'])
    })

    it(
      '',
      wrapper(async () => {
        console.log('(test) Starting the Codex Factory')
        await run(['start', '--fresh', '--detach'])

        console.log('(test) Trying to fetch the data')
        expect((await codexClient.marketplace.availabilities()).data).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringContaining(availabilityId),
            }),
          ]),
        )
      }),
    )
  })
})
