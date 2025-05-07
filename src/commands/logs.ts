import { Args, Flags } from '@oclif/core'

import { BaseCommand } from '../base.js'
import {
  ContainerType,
  DEFAULT_ENV_PREFIX,
  DEFAULT_IMAGE_PREFIX,
  Docker
} from '../utils/docker.js'

const ENV_ENV_PREFIX_KEY = 'FACTORY_ENV_PREFIX'
const ENV_IMAGE_PREFIX_KEY = 'FACTORY_IMAGE_PREFIX'

export default class Logs extends BaseCommand<typeof Logs> {
  static override args = {
    container: Args.string({ description: "Container name as described above", required: true }),
  };
  static override description = `Prints logs for given container. Valid container's names are: ${Object.values(
    ContainerType
  ).join(', ')}`
  static override examples = [
    '<%= config.bin %> <%= command.id %>'
  ]
  static override flags = {
    envPrefix: Flags.string({
      default: DEFAULT_ENV_PREFIX,
      description: 'Docker container\'s names prefix',
      env: ENV_ENV_PREFIX_KEY
    }),
    follow: Flags.boolean({
      char: 'f',
      default: false,
      description: 'Stays attached to the container and output any new logs'
    }),
    imagePrefix: Flags.string({
      default: DEFAULT_IMAGE_PREFIX,
      description: 'Docker image name prefix',
      env: ENV_IMAGE_PREFIX_KEY
    }),
    tail: Flags.integer({
      char: 't',
      description: 'Prints specified number of last log lines.',
      required: false
    })
  }

  public async run (): Promise<void> {
    const { args, flags } = await this.parse(Logs)

    if (!Object.values(ContainerType).includes(args.container as ContainerType)) {
      this.console.error(`Passed container name is not valid! Valid values: ${Object.values(ContainerType).join(', ')}`)
      // eslint-disable-next-line n/no-process-exit,unicorn/no-process-exit
      process.exit(1)
    }

    const docker = new Docker(this.console, flags.envPrefix, flags.imagePrefix)
    await docker.logs(args.container as ContainerType, process.stdout, flags.follow, flags.tail)
  }
}
