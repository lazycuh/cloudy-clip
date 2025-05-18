/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ConsoleLogEntryFormatter } from './formatter/console-log-entry-formatter';
import { LogLevel } from './log-level';
import { Logger } from './logger';
import { ConsoleLogTransport, LogTransport } from './transport';

describe(Logger.name, () => {
  beforeAll(() => {
    Logger.setTransport(new ConsoleLogTransport(new ConsoleLogEntryFormatter()));
  });

  it('Should use console based log transport by default', () => {
    const consoleTransportSpy = vi.spyOn(ConsoleLogTransport.prototype, 'send').mockImplementation(() => {});

    const logger = new Logger('main');

    const infoLogEntry = {
      context: 'main',
      level: LogLevel.INFO,
      message: 'Hi',
      timestamp: expect.any(Date)
    };
    logger.info(infoLogEntry.message);
    expect(consoleTransportSpy).toHaveBeenCalledWith(infoLogEntry);

    const exception = new Error('Expected');
    const errorLogEntry = {
      context: 'main',
      extra: {
        stacktrace: exception.stack?.split('\n') ?? []
      },
      level: LogLevel.ERROR,
      message: 'Hi',
      timestamp: expect.any(Date)
    };
    logger.error(errorLogEntry.message, exception, null);
    expect(consoleTransportSpy).toHaveBeenCalledWith(infoLogEntry);

    const warnLogEntry = {
      context: 'main',
      level: LogLevel.WARN,
      message: 'Hi',
      timestamp: expect.any(Date)
    };
    logger.warn(warnLogEntry.message);
    expect(consoleTransportSpy).toHaveBeenCalledWith(infoLogEntry);
  });

  it('Should use the configured log transport', () => {
    class TestLogTransport implements LogTransport {
      send() {}
    }
    const testLogTransport = new TestLogTransport();
    vi.spyOn(testLogTransport, 'send');

    const consoleTransportSpy = vi.spyOn(ConsoleLogTransport.prototype, 'send').mockImplementation(() => {});

    const logger = new Logger('main');

    Logger.setTransport(testLogTransport);

    logger.info('');
    logger.error('', new Error(), null);
    logger.warn('');

    expect(consoleTransportSpy).not.toHaveBeenCalled();
    expect(testLogTransport.send).toHaveBeenCalledTimes(3);
  });
});
