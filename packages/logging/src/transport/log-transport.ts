import { LogEntry } from '../log-entry';

export interface LogTransport {
  send(logEntry: LogEntry): void;
}
