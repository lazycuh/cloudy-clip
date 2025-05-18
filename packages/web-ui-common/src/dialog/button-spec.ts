import { Signal } from '@angular/core';

export type ButtonSpec = {
  class: string;
  label: string;
  onClick: VoidFunction;
  requiresConsent?: boolean;
  state?: Signal<'DISABLED' | 'LOADING' | 'NONE'>;
};
