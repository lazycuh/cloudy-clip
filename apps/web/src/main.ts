/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { ConsoleLogTransport, Logger } from '@lazycuh/logging';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

Logger.setTransport(new ConsoleLogTransport());

bootstrapApplication(AppComponent, appConfig).catch((err: unknown) => {
  console.error(err);
});
