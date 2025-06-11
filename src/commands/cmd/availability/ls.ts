import { Flags } from '@oclif/core'
import { Header } from 'tty-table'
import Table from 'tty-table'


import { BaseCommand } from '../../../base.js'
import { ContainerType } from '../../../utils/docker.js'
import { getClientForContainer } from '../../../utils/api.js'
import { formatBytes, formatId, formatTokenAmount } from '../../../utils/format.js'

export default class LsAvailability extends BaseCommand<typeof LsAvailability> {
  static override description = 'Lists all availabilities'
  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> -n client',
    '<%= config.bin %> <%= command.id %> --node host1'
  ]
  static override flags = {
    node: Flags.string({
      char: 'n',
      default: ContainerType.HOST,
      description: 'Node to run the command on',
      options: Object.values(ContainerType).filter((value) => value !== ContainerType.BLOCKCHAIN),
    })
  }

  public async run (): Promise<void> {
    const { flags } = await this.parse(LsAvailability)

    const header: Header[] = [
      {value: 'Availability ID'},
      {value: 'Total Size'},
      {value: 'Free Size'},
      {value: 'Total Collateral'},
      {value: 'Total Remaining Collateral'},
      {value: 'Min Price Per Byte Per Second'},
    ]

    const apiClient = getClientForContainer((flags.node as ContainerType))
    const availabilitiesResult = await apiClient.marketplace.availabilities()

    if (availabilitiesResult.error) {
      throw availabilitiesResult.data
    }

    const rows = availabilitiesResult.data.map((availability) => {
      return [
        formatId(availability.id),
        formatBytes(availability.totalSize),
        formatBytes(availability.freeSize || 0),
        formatTokenAmount(availability.totalCollateral),
        formatTokenAmount(availability.totalRemainingCollateral),
        formatTokenAmount(availability.minPricePerBytePerSecond),
      ]
    })


    // eslint-disable-next-line new-cap
    console.log(Table(header, rows).render())
  }

}
