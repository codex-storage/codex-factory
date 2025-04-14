import { Application } from 'furious-commander/dist/application'
import PackageJson from '../package.json'

export const application: Application = {
  name: 'Codex Factory',
  command: 'codex-factory',
  description: 'Orchestration CLI for spinning up local development Codex cluster with Docker',
  version: PackageJson.version,
  autocompletion: 'fromOption',
}
