import { provideHttpClient, withFetch } from '@angular/common/http';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { UserService } from '../../src/auth';

export function configureTestingModuleForService<T>(serviceClass: Type<T>): T {
  TestBed.configureTestingModule({
    providers: [UserService, provideHttpClient(withFetch()), serviceClass]
  });

  return TestBed.inject(serviceClass);
}
