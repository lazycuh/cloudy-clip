import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
  ViewEncapsulation,
  WritableSignal
} from '@angular/core';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'content-loading-indicator'
  },
  imports: [NgxSkeletonLoaderModule],
  selector: 'lc-content-loading-indicator',
  styleUrl: './content-loading-indicator.component.scss',
  templateUrl: './content-loading-indicator.component.html'
})
export class ContentLoadingIndicatorComponent {
  readonly appearance = input.required<'line' | 'circle' | 'list' | 'card'>();

  readonly count = input(1);
  readonly fixedWidth = input(false);
  readonly height = input<CSSStyleDeclaration['height']>('10px');
  readonly width = input<CSSStyleDeclaration['width']>('100%');

  protected readonly _widths = signal<Array<WritableSignal<string>>>([]);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      write: () => {
        const widths = [];

        for (let i = 0; i < this.count(); i++) {
          widths.push(signal(this.width()));
        }

        this._widths.set(widths);

        if (this.fixedWidth()) {
          return;
        }

        const timerHandle = setInterval(() => {
          for (const width of this._widths()) {
            width.set(`${Math.random() * 51 + 50}%`);
          }
        }, 2045);

        destroyRef.onDestroy(() => {
          clearInterval(timerHandle);
        });
      }
    });
  }

  protected _randomizeWidth() {
    return `${Math.random() * 50 + 50}%`;
  }
}
