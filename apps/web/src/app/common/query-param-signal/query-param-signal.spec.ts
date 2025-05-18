/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @stylistic/quotes */
import { DOCUMENT } from '@angular/common';
import { inject, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';
import { beforeEach, describe, expect, it } from 'vitest';

import { queryParamSignal } from './query-param-signal';

describe('queryParamSignal()', () => {
  const href = 'http://localhost:4200';

  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NoopAnimationsModule] });

    injector = TestBed.inject(Injector);

    const document = TestBed.inject(DOCUMENT);

    document.location.href = href;
  });

  it('Return an empty string when query name does not exist', () => {
    runInInjectionContext(injector, () => {
      expect(queryParamSignal('nothing')()).toEqual('');
    });
  });

  it("Return query param's value", () => {
    runInInjectionContext(injector, () => {
      const document = inject(DOCUMENT);
      document.location.href += '?message=hello';
      expect(queryParamSignal('message')()).toEqual('hello');
    });
  });

  it("Updating query param's value also updates query param in href", () => {
    runInInjectionContext(injector, async () => {
      const document = inject(DOCUMENT);
      document.location.href += '?message=hello';

      const queryParam = queryParamSignal('message');
      expect(queryParam()).toEqual('hello');
      expect(window.location.href).toContain('message=hello');
      expect(window.location.href).not.toContain('message=world');

      queryParam.set('world');
      expect(queryParam()).toEqual('world');

      await delayBy(250);
      expect(window.location.href).not.toContain('message=hello');
      expect(window.location.href).toContain('message=world');
    });
  });
});
