import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

import { ConsoleLogEntryFormatter } from '../formatter/console-log-entry-formatter';
import { LogEntry } from '../log-entry';
import { LogLevel } from '../log-level';

import { ConsoleLogTransport } from './console-log-transport';

describe(ConsoleLogTransport.name, () => {
  let consoleLogFormatSpy: MockInstance;

  beforeEach(() => {
    consoleLogFormatSpy = vi.spyOn(ConsoleLogEntryFormatter.prototype, 'format');
  });

  it('Should call console.info for INFO level', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const logEntry: LogEntry = {
      context: '',
      level: LogLevel.INFO,
      message: '',
      timestamp: new Date()
    };

    new ConsoleLogTransport(new ConsoleLogEntryFormatter()).send(logEntry);

    expect(console.info).toHaveBeenCalledOnce();
    expect(console.info).toHaveBeenCalledWith(consoleLogFormatSpy.mock.results[0]?.value);

    expect(consoleLogFormatSpy).toHaveBeenCalledOnce();
    expect(consoleLogFormatSpy).toHaveBeenCalledWith(logEntry);
  });

  it('Should call console.error for ERROR level', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const logEntry: LogEntry = {
      context: '',
      level: LogLevel.ERROR,
      message: '',
      timestamp: new Date()
    };

    new ConsoleLogTransport(new ConsoleLogEntryFormatter()).send(logEntry);

    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(consoleLogFormatSpy.mock.results[0]?.value);

    expect(consoleLogFormatSpy).toHaveBeenCalledOnce();
    expect(consoleLogFormatSpy).toHaveBeenCalledWith(logEntry);
  });

  it('Should call console.warn for WARN level', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const logEntry: LogEntry = {
      context: '',
      level: LogLevel.WARN,
      message: '',
      timestamp: new Date()
    };

    new ConsoleLogTransport(new ConsoleLogEntryFormatter()).send(logEntry);

    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith(consoleLogFormatSpy.mock.results[0]?.value);

    expect(consoleLogFormatSpy).toHaveBeenCalledOnce();
    expect(consoleLogFormatSpy).toHaveBeenCalledWith(logEntry);
  });
});
