import { cyanBright, gray, magentaBright, redBright, yellowBright } from 'console-log-colors';

import { LogEntry } from '../log-entry';
import { LogLevel } from '../log-level';

import { LogEntryFormatter } from './log-entry-formatter';

export class ConsoleLogEntryFormatter implements LogEntryFormatter {
  // eslint-disable-next-line consistent-return
  format(logEntry: LogEntry): string {
    const paddedLogLevel = this._padToWidth(logEntry.level, 5);
    const paddedContext = this._padToWidth(logEntry.context, 15, true);
    const logLevelPlaceholder = '{level}';
    const formattedLogEntry = [
      `${gray(logEntry.timestamp.toISOString())} |`,
      `${logLevelPlaceholder} |`,
      `[${paddedContext}] :`,
      magentaBright(logEntry.message)
    ].join(' ');

    switch (logEntry.level) {
      case LogLevel.INFO:
        return formattedLogEntry.replace(logLevelPlaceholder, cyanBright(paddedLogLevel));

      case LogLevel.ERROR:
        return (
          formattedLogEntry.replace(logLevelPlaceholder, redBright(paddedLogLevel)) +
          (logEntry.extra?.stacktrace ? `\n${this._colorizeStacktrace(logEntry.extra.stacktrace as string[])}` : '')
        );

      case LogLevel.WARN:
        return formattedLogEntry.replace(logLevelPlaceholder, yellowBright(paddedLogLevel));
    }
  }

  private _padToWidth(value: string, width: number, rightAligned = false) {
    const numberOfCharactersToFill = Math.max(width - value.length, 0);

    return !rightAligned
      ? `${value}${' '.repeat(numberOfCharactersToFill)}`
      : `${' '.repeat(numberOfCharactersToFill)}${value}`;
  }

  private _colorizeStacktrace(stacktrace: string[]) {
    return stacktrace.map(redBright).join('\n');
  }
}
