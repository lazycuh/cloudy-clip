import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'lc-icon'
  },
  selector: 'lc-icon',
  styleUrl: './icon.component.scss',
  templateUrl: './icon.component.html'
})
export class IconComponent {
  readonly viewBox = input('0 -960 960 960');
}
