import { LogLevel } from './log-level';

export interface LogEntry {
  readonly context: string;
  readonly extra?: Record<string, Json> | null;
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: Date;
}
