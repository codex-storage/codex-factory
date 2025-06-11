import { Codex } from '@codex-storage/sdk-js'

import { ContainerType } from './docker.js'


export function getClientForContainer (node: ContainerType): Codex {
  switch (node) {
    case ContainerType.CLIENT: {
      return new Codex('http://localhost:8080')
    }

    case ContainerType.HOST: {
      return new Codex('http://localhost:8081')
    }

    case ContainerType.HOST_2: {
      return new Codex('http://localhost:8082')
    }

    case ContainerType.HOST_3: {
      return new Codex('http://localhost:8083')
    }

    case ContainerType.HOST_4: {
      return new Codex('http://localhost:8084')
    }

    default: {
      throw new Error('Unsupported node type!')
    }

  }
}
