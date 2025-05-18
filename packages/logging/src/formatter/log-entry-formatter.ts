import { LogEntry } from '../log-entry';

export interface LogEntryFormatter {
  format(logEntry: LogEntry): string;
}
