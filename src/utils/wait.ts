import fetch, { FetchError } from 'node-fetch'
import { sleep } from './index'
import { TimeoutError } from './error'
import { AllStatus } from './docker'
import { Codex } from '@codex-storage/sdk-js'

const AWAIT_SLEEP = 3_000

const BLOCKCHAIN_BODY_REQUEST = JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', id: 1 })
const EXPECTED_CHAIN_ID = '0x7a69'
const ALLOWED_ERRORS = ['ECONNREFUSED', 'ECONNRESET', 'UND_ERR_SOCKET']

function isAllowedError(e: FetchError): boolean {
  //@ts-ignore: Node 18 native fetch returns error where the underlying error is wrapped and placed in e.cause
  if (e.cause) {
    //@ts-ignore: Node 18 native fetch returns error where the underlying error is wrapped and placed in e.cause
    e = e.cause
  }

  if (e.code && ALLOWED_ERRORS.includes(e.code)) {
    return true
  }

  // Errors from Bee-js does not have the `FetchError` structure (eq. `code` property)
  // so we assert message itself.
  if (e.message.includes('socket hang up')) {
    return true
  }

  return ALLOWED_ERRORS.some(substring => e.message.includes(substring))
}

function extractIpFromMultiaddr(multiaddr: string): string {
  const match = multiaddr.match(/\/ip4\/([\d.]+)\/tcp\/(\d+)/)

  if (match) {
    return match[1]
  } else {
    throw new Error('Unsupported multiaddr')
  }
}

export async function waitForBlockchain(waitingIterations = 30): Promise<void> {
  for (let i = 0; i < waitingIterations; i++) {
    try {
      const request = await fetch('http://127.0.0.1:8545', {
        method: 'POST',
        body: BLOCKCHAIN_BODY_REQUEST,
        headers: { 'Content-Type': 'application/json' },
      })
      const response = (await request.json()) as { result: string }

      if (response.result === EXPECTED_CHAIN_ID) {
        return
      }
    } catch (e) {
      if (!isAllowedError(e as FetchError)) {
        throw e
      }
    }

    await sleep(AWAIT_SLEEP)
  }

  throw new TimeoutError('Waiting for blockchain container timed-out')
}

export async function waitForClient(
  verifyClientIsUp: () => Promise<boolean>,
  waitingIterations = 120,
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
    } catch (e) {
      if (!isAllowedError(e as FetchError)) {
        throw e
      }
    }

    await sleep(AWAIT_SLEEP)
  }

  throw new TimeoutError('Waiting for client container timed-out')
}

export async function waitForHosts(
  hostCount: number,
  getStatus: () => Promise<AllStatus>,
  waitingIterations = 120,
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
    } catch (e) {
      if (!isAllowedError(e as FetchError)) {
        throw e
      }
    }

    await sleep(AWAIT_SLEEP)
  }

  throw new TimeoutError('Waiting for host nodes timed-out')
}
