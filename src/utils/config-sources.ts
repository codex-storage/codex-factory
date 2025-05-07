import type { PJSON } from '@oclif/core/interfaces'

import { readFile as readFileCb } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import semver from 'semver'


const readFile = promisify(readFileCb)
const VERSION_REGEX = /^\d+\.\d+\.\d+$/
const COMMIT_HASH_REGEX = /^([a-f0-9]{7,10})$/i

export function validateVersion (version: string, pkgJson: PJSON): string {
  if (version === 'latest') {
    return version
  }

  if (VERSION_REGEX.test(version)) {
    const supportedCodexVersion = pkgJson.engines.supportedCodex

    if (!semver.satisfies(version, supportedCodexVersion, { includePrerelease: true })) {
      throw new Error(
        `Unsupported Codex version!\nThis version of Codex Factory supports versions: ${supportedCodexVersion}, but you have requested start of ${version}`
      )
    }

    return version
  }

  if (COMMIT_HASH_REGEX.test(version)) {
    return `sha-${version}`
  }

  throw new Error('The version does not have expected format!')

}

async function searchPackageJson (): Promise<string | undefined> {
  const expectedPath = join(process.cwd(), 'package.json')

  try {
    const pkgJson = JSON.parse(await readFile(expectedPath, { encoding: 'utf8' }))

    return pkgJson?.engines?.codex
  } catch {
    return undefined
  }
}

async function searchCodexFactory (): Promise<string | undefined> {
  const expectedPath = join(process.cwd(), '.codexfactory.json')

  try {
    const pkgJson = JSON.parse(await readFile(expectedPath, { encoding: 'utf8' }))

    return pkgJson?.version
  } catch {
    return undefined
  }
}

export async function findCodexVersion (): Promise<string> {
  if (process.env.CODEX_FACTORY_VERSION) {
    return process.env.CODEX_FACTORY_VERSION
  }

  const packageJson = await searchPackageJson()

  if (packageJson) {
    return packageJson
  }

  const codexFactory = await searchCodexFactory()

  if (codexFactory) {
    return codexFactory
  }

  throw new Error('Codex Version was not specified nor it is present in expected external places!')
}
