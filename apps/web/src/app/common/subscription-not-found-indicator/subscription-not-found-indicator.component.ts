import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink } from '@angular/router';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { ProgressCompleteIndicatorComponent } from '@lazycuh/web-ui-common/progress-complete-indicator';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'subscription-not-found-indicator'
  },
  imports: [ProgressCompleteIndicatorComponent, MatRipple, ActionContainerComponent, RouterLink],
  selector: 'lc-subscription-not-found-indicator',
  styleUrl: './subscription-not-found-indicator.component.scss',
  templateUrl: './subscription-not-found-indicator.component.html'
})
export class SubscriptionNotFoundIndicatorComponent {
  private readonly _userEmail = inject(UserService)
    .findAuthenticatedUser()
    .map(user => user.email)
    .orElse(undefined);

  protected _resolveMailtoHref() {
    if (this._userEmail) {
      return getSupportEmailLink(
        'Active subscription not found',
        `My subscription is not available. My email address is ${this._userEmail}.`
      );
    }

    return getSupportEmailLink('Active subscription not found');
  }
}
