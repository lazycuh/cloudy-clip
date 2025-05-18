import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'privacy-policy'
  },
  imports: [],
  selector: 'lc-privacy-policy',
  styleUrl: './privacy-policy.component.scss',
  templateUrl: './privacy-policy.component.html'
})
export class PrivacyPolicyComponent {
  protected readonly _supportEmailLink = getSupportEmailLink('Questions about privacy policy');
}
