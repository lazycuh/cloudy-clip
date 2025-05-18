import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'refund-policy'
  },
  imports: [RouterLink],
  selector: 'lc-refund-policy',
  styleUrl: './refund-policy.component.scss',
  templateUrl: './refund-policy.component.html'
})
export class RefundPolicyComponent {
  protected readonly _supportEmailLink = getSupportEmailLink('Questions about refund policy');
}
