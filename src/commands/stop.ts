import { Flags } from '@oclif/core'
import ora from 'ora'

import { BaseCommand } from '../base.js'
import {
  DEFAULT_ENV_PREFIX,
  DEFAULT_IMAGE_PREFIX,
  Docker,
} from '../utils/docker.js'
import { VerbosityLevel } from '../utils/logging.js'


const ENV_ENV_PREFIX_KEY = 'FACTORY_ENV_PREFIX'
const ENV_IMAGE_PREFIX_KEY = 'FACTORY_IMAGE_PREFIX'
const ENV_RM = 'FACTORY_RM'

export default class Stop extends BaseCommand<typeof Stop> {
  static override description = 'Stops the Codex Factory cluster'
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
  ]
  static override flags = {
    envPrefix: Flags.string({
      default: DEFAULT_ENV_PREFIX,
      description: 'Docker container\'s names prefix',
      env: ENV_ENV_PREFIX_KEY
    }),
    imagePrefix: Flags.string({
      default: DEFAULT_IMAGE_PREFIX,
      description: 'Docker image name prefix',
      env: ENV_IMAGE_PREFIX_KEY
    }),
    rm: Flags.boolean({
      default: false,
      description: 'Remove the containers',
      env: ENV_RM
    })
  }

  public async run (): Promise<void> {
    const { flags } = await this.parse(Stop)

    const docker = new Docker(this.console, flags.envPrefix, flags.imagePrefix)

    const dockerSpinner = ora({
      color: 'yellow',
      isSilent: this.verbosity === VerbosityLevel.Quiet,
      spinner: 'point',
      text: 'Stopping all containers...'
    }).start()

    await docker.stopAll(true, flags.rm)

    dockerSpinner.succeed('Containers stopped')
  }
}
