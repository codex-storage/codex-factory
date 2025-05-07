import * as Dockerode from 'dockerode'

import { ENV_ENV_PREFIX_KEY } from '../../src/commands/start'

export async function findContainer(docker: Dockerode, name: string): Promise<Dockerode.ContainerInspectInfo> {
  return docker.getContainer(`${process.env[ENV_ENV_PREFIX_KEY]}-${name}`).inspect()
}

export async function deleteNetwork(docker: Dockerode, name: string): Promise<void> {
  const network = (await docker.listNetworks()).find(n => n.Name === name)
  if (network) {
    await docker.getNetwork(network.Id).remove()
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => {setTimeout(() => resolve(), ms)})
}
