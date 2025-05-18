import { Directive, HostListener } from '@angular/core';

@Directive()
export abstract class ClickEventBubblingStopper {
  @HostListener('click', ['$event'])
  protected _preventClickEventFromBubbling(event: Event) {
    event.stopPropagation();
  }
}
