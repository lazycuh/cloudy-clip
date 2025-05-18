import { LogEntryFormatter } from '../formatter';
import { LogEntry } from '../log-entry';
import { LogLevel } from '../log-level';

import { LogTransport } from './log-transport';

export class ConsoleLogTransport implements LogTransport {
  constructor(protected readonly _logEntryFormatter?: LogEntryFormatter) {}

  send(logEntry: LogEntry): void {
    switch (logEntry.level) {
      case LogLevel.INFO:
        console.info(this._logEntryFormatter?.format(logEntry) ?? logEntry);
        break;

      case LogLevel.ERROR:
        console.error(this._logEntryFormatter?.format(logEntry) ?? logEntry);
        break;

      case LogLevel.WARN:
        console.warn(this._logEntryFormatter?.format(logEntry) ?? logEntry);
        break;
    }
  }
}
