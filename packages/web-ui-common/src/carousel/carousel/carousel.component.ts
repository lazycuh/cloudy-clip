import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  DestroyRef,
  inject,
  output,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CarouselItemComponent } from '../carousel-item';
import { CarouselStepperDirective } from '../carousel-stepper';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'lc-carousel',
    role: 'tablist'
  },
  selector: 'lc-carousel',
  styleUrl: './carousel.component.scss',
  templateUrl: './carousel.component.html'
})
export class CarouselComponent {
  readonly carouselItemIndexChange = output<number>();

  protected readonly _activeCarouselItemIndex = signal(0);

  private readonly _carouselSteppers = contentChildren(CarouselStepperDirective, { descendants: true });
  private readonly _carouselItemQueryList = contentChildren(CarouselItemComponent);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      read: () => {
        /* istanbul ignore if -- @preserve */
        if (this._carouselItemQueryList().length === 0) {
          throw new Error('Carousel body has no carousel items');
        }

        this._carouselItemQueryList()[this._activeCarouselItemIndex()]!.toggle(true);

        if (this._carouselSteppers().length === 0) {
          return;
        }

        for (const carouselStepper of this._carouselSteppers()) {
          carouselStepper.activate.pipe(takeUntilDestroyed(destroyRef)).subscribe({
            next: () => {
              const newCarouselItemIndex = this._activeCarouselItemIndex() + carouselStepper.direction();
              this.switchToCarouselItem(newCarouselItemIndex);
              this.carouselItemIndexChange.emit(newCarouselItemIndex);
              this._activeCarouselItemIndex.set(newCarouselItemIndex);
            }
          });
        }
      }
    });
  }

  /**
   * Switches to the carousel item at the given index.
   *
   * @param index 0-based index of the carousel item to switch to
   */
  switchToCarouselItem(index: number) {
    if (index !== this._activeCarouselItemIndex() && index < this._carouselItemQueryList().length) {
      const previousCarouselItem = this._carouselItemQueryList()[this._activeCarouselItemIndex()]!;
      const newCarouselItem = this._carouselItemQueryList()[index]!;

      newCarouselItem.toggle(true);
      this._activeCarouselItemIndex.set(index);
      previousCarouselItem.toggle(false);
    }
  }

  nextCarouselItem() {
    this.switchToCarouselItem((this._activeCarouselItemIndex() + 1) % this._carouselItemQueryList().length);
  }

  previousCarouselItem() {
    this.switchToCarouselItem(
      this._activeCarouselItemIndex() === 0
        ? this._carouselItemQueryList().length - 1
        : this._activeCarouselItemIndex() - 1
    );
  }
}
