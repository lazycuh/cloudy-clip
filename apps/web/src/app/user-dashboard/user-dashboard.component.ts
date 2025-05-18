import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '@lazycuh/web-ui-common/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'user-dashboard'
  },
  imports: [RouterOutlet, IconComponent, RouterLink, RouterLinkActive],
  selector: 'lc-user-dashboard',
  styleUrl: './user-dashboard.component.scss',
  templateUrl: './user-dashboard.component.html'
})
export class UserDashboardComponent {}
