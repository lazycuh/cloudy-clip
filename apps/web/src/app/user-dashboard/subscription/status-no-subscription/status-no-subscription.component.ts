import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink } from '@angular/router';
import { InfoBoxComponent } from '@lazycuh/web-ui-common/message-box/info-box';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'user-dashboard__section__content'
  },
  imports: [InfoBoxComponent, MatRipple, RouterLink],
  selector: 'lc-status-no-subscription',
  styleUrl: './status-no-subscription.component.scss',
  templateUrl: './status-no-subscription.component.html'
})
export class StatusNoSubscriptionComponent {
  readonly userEmail = input.required<string>();

  protected _getSupportEmailLink() {
    return getSupportEmailLink(
      'Active subscription not found',
      `My subscription is not available. My email address is ${this.userEmail()}.`
    );
  }
}
