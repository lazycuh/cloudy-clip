import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'dot-dot-dot'
  },
  selector: 'lc-dot-dot-dot',
  styleUrls: ['./dot-dot-dot.component.scss'],
  templateUrl: './dot-dot-dot.component.html'
})
export class DotDotDotComponent {
  protected readonly _dots = signal('');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      write: () => {
        let numberOfDots = 0;
        let direction: 1 | -1 = 1;

        timer(0, 1000)
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe({
            next: () => {
              if (numberOfDots === 3) {
                direction = -1;
              } else if (numberOfDots === 0) {
                direction = 1;
              }

              numberOfDots += direction;
              this._dots.set('. '.repeat(numberOfDots).trim());
            }
          });
      }
    });
  }
}
