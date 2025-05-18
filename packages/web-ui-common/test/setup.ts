/* eslint-disable vitest/require-top-level-describe */
/* eslint-disable simple-import-sort/imports */
import '@angular/localize/init';
import '@testing-library/jest-dom';
import 'whatwg-fetch';

import { TextDecoder, TextEncoder } from 'util';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { ConsoleLogTransport, Logger } from '@lazycuh/logging';
import { afterEach, beforeEach, vi } from 'vitest';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Directive } from '@angular/core';

(global as Record<string, unknown>).TextEncoder = TextEncoder;
(global as Record<string, unknown>).TextDecoder = TextDecoder;

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

Logger.setTransport(new ConsoleLogTransport());

@Directive()
class MockDirective {}

vi.mock('@lazycuh/angular-tooltip', async () => {
  const actual = await vi.importActual('@lazycuh/angular-tooltip');

  return {
    ...actual,

    TooltipDirective: MockDirective
  };
});

beforeEach(() => {
  // eslint-disable-next-line vitest/prefer-spy-on
  window.location.reload = vi.fn();

  vi.spyOn(Logger.prototype, 'error');
  vi.spyOn(Router.prototype, 'navigateByUrl').mockResolvedValue(true);

  vi.spyOn(HttpClient.prototype, 'get');
  vi.spyOn(HttpClient.prototype, 'post');
  vi.spyOn(HttpClient.prototype, 'put');
  vi.spyOn(HttpClient.prototype, 'delete');
  vi.spyOn(HttpClient.prototype, 'patch');
});

afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});
