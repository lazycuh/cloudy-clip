import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@lazycuh/web-ui-common/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'site-footer'
  },
  imports: [RouterLink, IconComponent],
  selector: 'lc-footer',
  styleUrl: './footer.component.scss',
  templateUrl: './footer.component.html'
})
export class FooterComponent {
  protected readonly _currentYear = new Date().getFullYear();
}
