import { Command, Flags, Interfaces } from "@oclif/core";

import { Logging, VerbosityLevel } from "./utils/logging.js";

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<T["flags"] & typeof BaseCommand["baseFlags"]>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T["args"]>

export abstract class BaseCommand<T extends typeof Command> extends Command {
  static baseFlags = {
    quiet: Flags.boolean({
      default: false,
      description: "Does not print anything.",
    }),
    verbose: Flags.boolean({
      default: false,
      description: "Display logs.",
    }),
  };
  protected args!: Args<T>;
  public console!: Logging;
  protected flags!: Flags<T>;
  public verbosity!: VerbosityLevel;

  public async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      args: this.ctor.args,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      flags: this.ctor.flags,
      strict: this.ctor.strict,
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;

    this.verbosity = VerbosityLevel.Normal;

    if (flags.quiet) {
      this.verbosity = VerbosityLevel.Quiet;
    }

    if (flags.verbose) {
      this.verbosity = VerbosityLevel.Verbose;
    }

    this.console = new Logging(this.verbosity);
  }
}
