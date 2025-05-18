import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.is-pulsing]': 'pulsing()',
    class: 'pulse-loader'
  },
  imports: [],
  selector: 'lc-pulse-loader',
  styleUrl: './pulse-loader.component.scss',
  templateUrl: './pulse-loader.component.html'
})
export class PulseLoaderComponent {
  readonly pulsing = input.required<boolean>();

  readonly message = input<string>();
}
