import type { ILogger, LogContext } from '../types';

export interface InternalLogger extends ILogger {
  readonly verbose: boolean;
}

const consoleLogger: ILogger = {
  debug(message: string, context?: LogContext): void {
    if (context) {
      console.debug(message, context);
      return;
    }

    console.debug(message);
  },
  error(message: string, context?: LogContext): void {
    if (context) {
      console.error(message, context);
      return;
    }

    console.error(message);
  },
  info(message: string, context?: LogContext): void {
    if (context) {
      console.info(message, context);
      return;
    }

    console.info(message);
  },
  warn(message: string, context?: LogContext): void {
    if (context) {
      console.warn(message, context);
      return;
    }

    console.warn(message);
  },
};

export function createInternalLogger(config?: {
  readonly logger?: ILogger;
  readonly verbose?: boolean;
}): InternalLogger {
  const logger = config?.logger ?? consoleLogger;
  const verbose = config?.verbose ?? false;

  return {
    debug(message: string, context?: LogContext): void {
      if (!verbose) {
        return;
      }

      logger.debug(message, context);
    },
    error(message: string, context?: LogContext): void {
      logger.error(message, context);
    },
    info(message: string, context?: LogContext): void {
      logger.info(message, context);
    },
    verbose,
    warn(message: string, context?: LogContext): void {
      logger.warn(message, context);
    },
  };
}
