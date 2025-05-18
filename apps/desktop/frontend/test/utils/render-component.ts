import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideExperimentalZonelessChangeDetection, Type } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { render, RenderComponentOptions, RenderResult } from '@testing-library/angular';
import { routes } from 'src/app/app.routes';

import { UserService } from '@lazycuh/web-ui-common/auth';
import { EntitlementService } from '@lazycuh/web-ui-common/entitlement';
import { TaskService } from '@common/task';
import { delayBy } from '@lazycuh/web-ui-common/utils/delay-by';

export async function renderComponent<T>(
  component: Type<T>,
  options: RenderComponentOptions<T> = {}
): Promise<RenderResult<T>> {
  options.providers ??= [];
  // Have to add these providers to the beginning of the array to avoid weird failures during testing
  options.providers.unshift(
    TaskService,
    EntitlementService,
    UserService,
    provideRouter(routes),
    provideNoopAnimations(),
    provideHttpClient(withFetch()),
    provideExperimentalZonelessChangeDetection(),
    { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: '-1200' } }
  );

  // Tell Angular to render `@defer` blocks too
  options.deferBlockBehavior = 1;

  const renderResult = await render(component, options);

  await delayBy(process.env.CIRCLE_BRANCH ? 500 : 16);

  return renderResult;
}
