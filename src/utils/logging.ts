import chalk from 'chalk'

const Printer = {
  dimFunction(message: string, ...args: unknown[]): void {
    console.log(chalk.dim(message), ...args)
  },
  divider(char = '-'): void {
    console.log(char.repeat(process.stdout.columns))
  },
  emptyFunction(): void {

  },
  error(message: string, ...args: unknown[]): void {
    console.error(chalk.red(message), ...args)
  },
  info(message: string, ...args: unknown[]): void {
    console.log(chalk.dim(message), ...args)
  },
  log(message: string, ...args: unknown[]): void {
    console.log(message, ...args)
  },
}

export enum VerbosityLevel {
  /** No output message, only at errors or result strings (e.g. hash of uploaded file) */
  Quiet,
  /** Formatted informal messages at end of operations, output row number is equal at same operations */
  Normal,
  /** dim messages, gives info about state of the operation frequently. Default */
  Verbose,
}

type PrinterFnc = (message: string, ...args: unknown[]) => void

export class Logging {
  /** Error messages */
  public error: PrinterFnc
  // Callable logging functions (instead of console.log)
/** Informal messages (e.g. Tips) */
  public info: PrinterFnc
  /** Identical with console.log */
  public log: PrinterFnc
  public readonly verbosityLevel: VerbosityLevel

  constructor(verbosityLevel: VerbosityLevel) {
    this.verbosityLevel = verbosityLevel
    switch (verbosityLevel) {
      case VerbosityLevel.Normal: {
        this.error = Printer.error
        this.log = Printer.log
        this.info = Printer.emptyFunction
        break
      }

      case VerbosityLevel.Verbose: {
        this.error = Printer.error
        this.log = Printer.log
        this.info = Printer.info
        break
      }

      default: {
        // quiet
        this.error = Printer.error
        this.log = Printer.emptyFunction
        this.info = Printer.emptyFunction
      }
    }
  }
}
