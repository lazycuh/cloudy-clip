import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { ConfirmationCaptureService } from '@lazycuh/angular-confirmation-capture';

import { IconComponent } from '../icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'back-button'
  },
  imports: [IconComponent, MatRipple],
  selector: 'lc-back-button',
  styleUrl: './back-button.component.scss',
  templateUrl: './back-button.component.html'
})
export class BackButtonComponent {
  readonly shouldShowConfirmation = input(false);

  private readonly _location = inject(Location);
  private readonly _confirmationCaptureService = inject(ConfirmationCaptureService);

  protected async _onBack() {
    if (this.shouldShowConfirmation()) {
      const confirmed = await this._confirmationCaptureService.open({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        content: $localize`Are you sure you want to go back to previous page?`
      });

      if (!confirmed) {
        return;
      }
    }

    this._location.back();
  }
}
