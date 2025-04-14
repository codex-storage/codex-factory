import { readFile as readFileCb } from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import PackageJson from '../../package.json'
import semver from 'semver'

const readFile = promisify(readFileCb)
const VERSION_REGEX = /^\d+\.\d+\.\d+$/
const COMMIT_HASH_REGEX = /^([a-f0-9]{7,10})$/i

export function validateVersion(version: string): string {
  if (version === 'latest') {
    return version
  }

  if (VERSION_REGEX.test(version)) {
    const supportedCodexVersion = PackageJson.engines.supportedCodex

    if (!semver.satisfies(version, supportedCodexVersion, { includePrerelease: true })) {
      throw new Error(
        `Unsupported Codex version!\nThis version of Codex Factory supports versions: ${supportedCodexVersion}, but you have requested start of ${version}`,
      )
    }

    return version
  } else if (COMMIT_HASH_REGEX.test(version)) {
    return `sha-${version}`
  } else {
    throw new Error('The version does not have expected format!')
  }
}

async function searchPackageJson(): Promise<string | undefined> {
  const expectedPath = path.join(process.cwd(), 'package.json')

  try {
    const pkgJson = JSON.parse(await readFile(expectedPath, { encoding: 'utf8' }))

    return pkgJson?.engines?.codex
  } catch (e) {
    return undefined
  }
}

async function searchCodexFactory(): Promise<string | undefined> {
  const expectedPath = path.join(process.cwd(), '.codexfactory.json')

  try {
    const pkgJson = JSON.parse(await readFile(expectedPath, { encoding: 'utf8' }))

    return pkgJson?.version
  } catch (e) {
    return undefined
  }
}

export async function findCodexVersion(): Promise<string> {
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
