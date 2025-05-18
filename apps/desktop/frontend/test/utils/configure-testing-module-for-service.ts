import { provideHttpClient, withFetch } from '@angular/common/http';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { UserService } from '@lazycuh/web-ui-common/auth';
import { TaskService } from '@common/task';

export function configureTestingModuleForService<T>(serviceClass: Type<T>): T {
  TestBed.configureTestingModule({
    providers: [UserService, provideHttpClient(withFetch()), TaskService, serviceClass]
  });

  return TestBed.inject(serviceClass);
}
