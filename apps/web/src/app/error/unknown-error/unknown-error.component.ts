import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { Router } from '@angular/router';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';
import { PageReloaderDirective } from '@lazycuh/web-ui-common/utils/page-reloader';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'unknown-error'
  },
  imports: [MatRipple, PageReloaderDirective],
  selector: 'lc-unknown-error',
  styleUrl: './unknown-error.component.scss',
  templateUrl: './unknown-error.component.html'
})
export class UnknownErrorComponent {
  protected readonly _requestId: string = '';

  private readonly _userEmail = inject(UserService).findCurrentUserEmail().orElse('');

  constructor() {
    const router = inject(Router);
    this._requestId = (router.getCurrentNavigation()?.extras.state?.requestId as string | undefined) ?? '';
  }

  protected _getContactUsLink() {
    if (this._requestId) {
      return getSupportEmailLink(
        'Unknown error',
        `Request ID: ${this._requestId}\nAccount email: ${this._userEmail}\nError description:`
      );
    }

    return getSupportEmailLink('Unknown error', `Account email: ${this._userEmail}\nError description:`);
  }
}
