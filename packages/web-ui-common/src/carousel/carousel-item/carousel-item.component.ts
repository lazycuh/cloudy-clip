import { NgTemplateOutlet } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  input,
  signal,
  TemplateRef,
  ViewEncapsulation
} from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[attr.aria-hidden]': '!_isActive()',
    '[class]': '_isActive() ? "is-active" : "is-inactive"',
    class: 'carousel-item',
    role: 'tabpanel'
  },
  imports: [NgTemplateOutlet],
  selector: 'lc-carousel-item',
  styleUrl: './carousel-item.component.scss',
  templateUrl: './carousel-item.component.html'
})
export class CarouselItemComponent implements AfterContentInit {
  readonly lazy = input(false);

  protected readonly _isActive = signal(false);

  protected readonly _carouselContentTemplateRef = contentChild(TemplateRef, { read: TemplateRef });

  ngAfterContentInit() {
    /* istanbul ignore if -- @preserve */
    if (this.lazy() && this._carouselContentTemplateRef() === undefined) {
      /* istanbul ignore next -- @preserve */
      // eslint-disable-next-line @stylistic/quotes
      throw new Error("Lazy carousel item's content must be wrapped inside ng-template");
    }
  }

  toggle(isActive: boolean) {
    if (this._isActive() === isActive) {
      return;
    }

    this._isActive.set(isActive);
  }
}
