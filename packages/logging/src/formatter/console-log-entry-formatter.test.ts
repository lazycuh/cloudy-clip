import * as consoleLogColorsModule from 'console-log-colors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogLevel } from '../log-level';

import { ConsoleLogEntryFormatter } from './console-log-entry-formatter';

vi.mock('console-log-colors', () => {
  return {
    cyanBright: vi.fn(),
    gray: vi.fn(),
    magentaBright: vi.fn(),
    redBright: vi.fn(),
    yellowBright: vi.fn()
  };
});

describe(ConsoleLogEntryFormatter.name, () => {
  beforeEach(() => {
    vi.spyOn(consoleLogColorsModule, 'cyanBright').mockImplementation((arg: unknown) => String(arg));
    vi.spyOn(consoleLogColorsModule, 'gray').mockImplementation((arg: unknown) => String(arg));
    vi.spyOn(consoleLogColorsModule, 'magentaBright').mockImplementation((arg: unknown) => String(arg));
    vi.spyOn(consoleLogColorsModule, 'redBright').mockImplementation((arg: unknown) => String(arg));
    vi.spyOn(consoleLogColorsModule, 'yellowBright').mockImplementation((arg: unknown) => String(arg));
  });

  it('Should have the expected format', () => {
    const formatter = new ConsoleLogEntryFormatter();
    const now = new Date();
    const formattedLogEntry = formatter.format({
      context: ConsoleLogEntryFormatter.name,
      level: LogLevel.INFO,
      message: 'Hello World',
      timestamp: now
    });

    expect(formattedLogEntry).toMatch(`${now.toISOString()} | `);
    expect(formattedLogEntry).toMatch(`${LogLevel.INFO}  | `);
    expect(formattedLogEntry).toMatch(`[${ConsoleLogEntryFormatter.name}] : `);
    expect(formattedLogEntry).toMatch('Hello World');
  });

  it('Should pad log level, context to the expected widths and right-align context', () => {
    const formatter = new ConsoleLogEntryFormatter();
    const now = new Date();
    const formattedLogEntry = formatter.format({
      context: 'main',
      level: LogLevel.INFO,
      message: 'Hello World',
      timestamp: now
    });

    expect(formattedLogEntry).toMatch(`${now.toISOString()} | `);
    expect(formattedLogEntry).toMatch(new RegExp(`${LogLevel.INFO}\\s{2}\\| `));
    expect(formattedLogEntry).toMatch(new RegExp('\\[\\s{11}main\\] : '));
    expect(formattedLogEntry).toMatch('Hello World');
  });

  it('Should use the expected colors for INFO', () => {
    vi.spyOn(consoleLogColorsModule, 'cyanBright').mockImplementation((arg: unknown) => `cyanBright(${String(arg)})`);
    vi.spyOn(consoleLogColorsModule, 'gray').mockImplementation((arg: unknown) => `gray(${String(arg)})`);
    vi.spyOn(consoleLogColorsModule, 'magentaBright').mockImplementation(
      (arg: unknown) => `magentaBright(${String(arg)})`
    );

    const formatter = new ConsoleLogEntryFormatter();
    const now = new Date();
    const formattedLogEntry = formatter.format({
      context: 'main',
      level: LogLevel.INFO,
      message: 'Hello World',
      timestamp: now
    });

    expect(formattedLogEntry).toMatch(`gray(${now.toISOString()}) | `);
    expect(formattedLogEntry).toMatch(`cyanBright(${LogLevel.INFO} ) | `);
    expect(formattedLogEntry).toMatch(' : magentaBright(Hello World)');
  });

  it('Should use the expected colors for ERROR', () => {
    vi.spyOn(consoleLogColorsModule, 'gray').mockImplementation((arg: unknown) => `gray(${String(arg)})`);
    vi.spyOn(consoleLogColorsModule, 'magentaBright').mockImplementation(
      (arg: unknown) => `magentaBright(${String(arg)})`
    );
    vi.spyOn(consoleLogColorsModule, 'redBright').mockImplementation((arg: unknown) => `red(${String(arg)})`);

    const formatter = new ConsoleLogEntryFormatter();
    const now = new Date();
    const formattedLogEntry = formatter.format({
      context: 'main',
      level: LogLevel.ERROR,
      message: 'Hello World',
      timestamp: now
    });

    expect(formattedLogEntry).toMatch(`gray(${now.toISOString()}) | `);
    expect(formattedLogEntry).toMatch(`red(${LogLevel.ERROR}) | `);
    expect(formattedLogEntry).toMatch(' : magentaBright(Hello World)');
  });

  it('Should use the expected colors for WARNING', () => {
    vi.spyOn(consoleLogColorsModule, 'gray').mockImplementation((arg: unknown) => `gray(${String(arg)})`);
    vi.spyOn(consoleLogColorsModule, 'magentaBright').mockImplementation(
      (arg: unknown) => `magentaBright(${String(arg)})`
    );
    vi.spyOn(consoleLogColorsModule, 'yellowBright').mockImplementation(
      (arg: unknown) => `yellowBright(${String(arg)})`
    );

    const formatter = new ConsoleLogEntryFormatter();
    const now = new Date();
    const formattedLogEntry = formatter.format({
      context: 'main',
      level: LogLevel.WARN,
      message: 'Hello World',
      timestamp: now
    });

    expect(formattedLogEntry).toMatch(`gray(${now.toISOString()}) | `);
    expect(formattedLogEntry).toMatch(`yellowBright(${LogLevel.WARN} ) | `);
    expect(formattedLogEntry).toMatch(' : magentaBright(Hello World)');
  });
});
