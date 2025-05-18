import { Directive, HostListener, input } from '@angular/core';
import { Subject } from 'rxjs';

import { CarouselNavigationDirection } from '../carousel-navigation-direction';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[lc-carousel-stepper]'
})
export class CarouselStepperDirective {
  readonly direction = input.required<CarouselNavigationDirection>({ alias: 'lc-carousel-stepper' });
  readonly activate = new Subject<void>();

  @HostListener('click')
  protected _onClick() {
    this.activate.next();
  }
}
