import { afterNextRender, ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { AnchoredFloatingBox } from '@lazycuh/angular-anchored-floating-box';
import { ConfirmationCaptureService } from '@lazycuh/angular-confirmation-capture';
import { NotificationService } from '@lazycuh/angular-notification';
import { TooltipService } from '@lazycuh/angular-tooltip';
import { Logger } from '@lazycuh/logging';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { performScroll, scrollToTop } from '@lazycuh/web-ui-common/utils/scroller';

import { ClipboardHistoryComponent } from './clipboard-history';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'cloudy-clip'
  },
  imports: [ClipboardHistoryComponent],
  selector: 'lc-app',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html'
})
export class AppComponent {
  private readonly _logger = new Logger('AppComponent');

  constructor() {
    const router = inject(Router);
    const progressService = inject(ProgressService);

    afterNextRender({
      write: () => {
        AnchoredFloatingBox.setDefaultTheme('dark');
        TooltipService.setDefaultTheme('dark');

        ConfirmationCaptureService.setDefaultCancelButtonLabel($localize`Cancel`);
        ConfirmationCaptureService.setDefaultConfirmButtonLabel($localize`Confirm`);

        NotificationService.setDefaultCloseButtonLabel($localize`Close`);

        router.events.subscribe({
          next: routerEvent => {
            if (routerEvent instanceof NavigationStart) {
              void progressService.openIndeterminateProgressIndicator();
            } else if (routerEvent instanceof NavigationEnd) {
              setTimeout(() => {
                if (!this._scrollToAnchorIfExists() && router.navigated) {
                  scrollToTop();
                }
              }, 16);

              progressService.close();
              document.body.dataset.currentRoute = routerEvent.urlAfterRedirects.split('?')[0];
            } else if (routerEvent instanceof NavigationCancel || routerEvent instanceof NavigationError) {
              progressService.close();
            }
          }
        });
      }
    });
  }

  private _scrollToAnchorIfExists() {
    // Hash also includes search params but we don't need search params here
    const hash = window.location.hash.split('?')[0];

    if (!hash) {
      return false;
    }

    const anchorElement = document.querySelector(hash);

    if (!anchorElement) {
      this._logger.warn(`unable to locate anchor element with selector '${hash}'`);

      return false;
    }

    // have to account for the current scroll position too
    const scrollTarget = document.body.scrollTop + anchorElement.getBoundingClientRect().top - 8;
    performScroll(t => scrollTarget * t);

    return true;
  }
}
