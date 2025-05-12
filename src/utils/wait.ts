/* eslint-disable no-await-in-loop */
import { Codex } from '@codex-storage/sdk-js'
import fetch, { FetchError } from 'node-fetch'

import { AllStatus } from './docker.js'
import { TimeoutError } from './error.js'
import { sleep } from './index.js'

const AWAIT_SLEEP = 1000

const BLOCKCHAIN_BODY_REQUEST = JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'eth_chainId' })
const EXPECTED_CHAIN_ID = '0x7a69'
const ALLOWED_ERRORS = ['ECONNREFUSED', 'ECONNRESET', 'UND_ERR_SOCKET', 502] as string[]

function isAllowedError(e: FetchError): boolean {
  if (e.cause) {
    // @ts-expect-error: Node 18 native fetch returns error where the underlying error is wrapped and placed in e.cause
    e = e.cause
  }

  if (e.code && ALLOWED_ERRORS.includes(e.code)) {
    return true
  }

  if (e.message.includes('socket hang up')) {
    return true
  }

  return ALLOWED_ERRORS.some(substring => e.message.includes(substring))
}

function extractIpFromMultiaddr(multiaddr: string): string {
  const match = multiaddr.match(/\/ip4\/([\d.]+)\/tcp\/(\d+)/)

  if (match) {
    return match[1]
  }

    throw new Error('Unsupported multiaddr')

}

export async function waitForBlockchain(waitingIterations = 90): Promise<void> {
  for (let i = 0; i < waitingIterations; i++) {
    try {
      const request = await fetch('http://127.0.0.1:8545', {
        body: BLOCKCHAIN_BODY_REQUEST,
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const response = (await request.json()) as { result: string }

      if (response.result === EXPECTED_CHAIN_ID) {
        return
      }
    } catch (error) {
      if (!isAllowedError(error as FetchError)) {
        throw error
      }
    }

    await sleep(AWAIT_SLEEP)
  }

  throw new TimeoutError('Waiting for blockchain container timed-out')
}

export async function waitForClient(
  verifyClientIsUp: () => Promise<boolean>,
  waitingIterations = 300,
): Promise<string> {
  const codex = new Codex('http://127.0.0.1:8080')

  for (let i = 0; i < waitingIterations; i++) {
    try {
      if (!(await verifyClientIsUp())) {
        throw new Error('Client node is not running!')
      }

      const info = await codex.debug.info()

      if (info.error) {
        throw info.data
      }

      if (info.data.addrs.length > 0) {
        const addr = info.data.addrs.find(addr => !addr.includes('127.0.0.1'))

        if (addr) {
          return extractIpFromMultiaddr(addr)
        }
      }
    } catch (error) {
      if (!isAllowedError(error as FetchError)) {
        throw error
      }
    }

    await sleep(AWAIT_SLEEP)
  }

  throw new TimeoutError('Waiting for client container timed-out')
}

export async function waitForHosts(
  hostCount: number,
  getStatus: () => Promise<AllStatus>,
  waitingIterations = 300,
): Promise<void> {
  const codex = new Codex('http://127.0.0.1:8080')

  const status = await getStatus()

  if (status[`host` as keyof AllStatus] !== 'running') {
    throw new Error('Some of the hosts node is not running!')
  }

  for (let i = 2; i <= hostCount; i++) {
    if (status[`host_${i}` as keyof AllStatus] !== 'running') {
      throw new Error('Some of the hosts node is not running!')
    }
  }

  for (let i = 0; i < waitingIterations; i++) {
    try {
      const info = await codex.debug.info()

      if (info.error) {
        throw info.data
      }

      if (info.data.table.nodes.length >= hostCount) {
        return
      }
    } catch (error) {
      if (!isAllowedError(error as FetchError)) {
        throw error
      }
    }

    await sleep(AWAIT_SLEEP)
  }

  throw new TimeoutError('Waiting for host nodes timed-out')
}
