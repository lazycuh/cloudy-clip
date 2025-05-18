import { LogEntry } from './log-entry';
import { LogLevel } from './log-level';
import { LogTransport } from './transport/log-transport';

export class Logger {
  private static _logTransport?: LogTransport;

  constructor(
    private readonly _context: string,
    private _userEmail?: string
  ) {}

  static setTransport(newLogTransport: LogTransport) {
    Logger._logTransport = newLogTransport;
  }

  error(message: string, errorInfo: unknown, extra?: LogEntry['extra']) {
    extra = Object.assign({}, extra);

    if (errorInfo instanceof Error) {
      extra.errorInfo = {
        message: errorInfo.message,
        stacktrace: errorInfo.stack ?? null
      };
    } else {
      extra.errorInfo = errorInfo as Json;
    }

    this._log(message, LogLevel.ERROR, extra);
  }

  private _log(message: string, level: LogLevel, extra?: LogEntry['extra']) {
    if (extra) {
      extra = Object.assign({}, extra);

      if (this._userEmail) {
        extra.email = this._userEmail;
      }
    }

    Logger._logTransport?.send({
      context: this._context,
      extra,
      level,
      message,
      timestamp: new Date()
    });
  }

  info(message: string, extra?: LogEntry['extra']) {
    this._log(message, LogLevel.INFO, extra);
  }

  warn(message: string, extra?: LogEntry['extra']) {
    this._log(message, LogLevel.WARN, extra);
  }
}
