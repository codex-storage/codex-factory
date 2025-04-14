import Dockerode from 'dockerode'
import { ENV_ENV_PREFIX_KEY } from '../../src/command/start'

export async function findContainer(docker: Dockerode, name: string): Promise<Dockerode.ContainerInspectInfo> {
  return docker.getContainer(`${process.env[ENV_ENV_PREFIX_KEY]}-${name}`).inspect()
}

export async function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(() => resolve(), ms))
}
