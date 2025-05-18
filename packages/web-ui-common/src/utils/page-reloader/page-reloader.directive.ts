import { Directive, HostListener } from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[lc-reload-page]'
})
export class PageReloaderDirective {
  @HostListener('click')
  onClick() {
    window.location.reload();
  }
}
