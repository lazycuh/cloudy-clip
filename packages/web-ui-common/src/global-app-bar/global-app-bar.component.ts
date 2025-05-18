import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatRipple } from '@angular/material/core';
import { Router, RouterLink } from '@angular/router';
import { TooltipDirective } from '@lazycuh/angular-tooltip';

import { UserService } from '@lazycuh/web-ui-common/auth';
import { IconComponent } from '@lazycuh/web-ui-common/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class]': '_isUserLoggedIn() ? "user-is-logged-in" : "user-is-not-logged-in"',
    class: 'global-app-bar'
  },
  imports: [RouterLink, IconComponent, MatRipple, TooltipDirective],
  selector: 'lc-global-app-bar',
  styleUrls: ['./global-app-bar.component.scss', './_global-app-bar.component.scss'],
  templateUrl: './global-app-bar.component.html'
})
export class GlobalAppBarComponent {
  private readonly _userService = inject(UserService);
  private readonly _router = inject(Router);

  protected readonly _isUserLoggedIn = toSignal(this._userService.loginStatusChanges());

  protected async _logout() {
    try {
      void this._router.navigateByUrl('/login');
      await this._userService.signOut();
    } catch {
      // ignored
    }
  }
}
