import { afterNextRender, ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet
} from '@angular/router';
import { AnchoredFloatingBox } from '@lazycuh/angular-anchored-floating-box';
import { ConfirmationCaptureService } from '@lazycuh/angular-confirmation-capture';
import { NotificationService } from '@lazycuh/angular-notification';
import { Logger } from '@lazycuh/logging';
import { GlobalAppBarComponent } from '@lazycuh/web-ui-common/global-app-bar';
import { ProgressService } from '@lazycuh/web-ui-common/progress';
import { isMobile } from '@lazycuh/web-ui-common/utils/is-mobile';
import { performScroll, scrollToTop } from '@lazycuh/web-ui-common/utils/scroller';
import { loadStripe } from '@stripe/stripe-js';

import { TextEditorComponent } from '@common/text-editor';

import { FooterComponent } from './footer';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'cloudy-clip'
  },
  imports: [RouterOutlet, GlobalAppBarComponent, FooterComponent, TextEditorComponent],
  selector: 'lc-app',
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html'
})
export class AppComponent {
  protected readonly control = new FormControl('', { nonNullable: true });

  constructor() {
    const router = inject(Router);
    const progressService = inject(ProgressService);

    afterNextRender({
      write: () => {
        if (isMobile()) {
          document.body.classList.add('is-mobile');
        }

        AnchoredFloatingBox.setDefaultTheme('dark');

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

        void loadStripe(__STRIPE_API_KEY__)
          .then(stripeInstance => {
            window.stripeInstance = stripeInstance;
          })
          .catch((error: unknown) => {
            new Logger('AppComponent').error('failed to initialize stripe', error);
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
      new Logger('AppComponent').warn(`unable to locate anchor element with selector '${hash}'`);

      return false;
    }

    // have to account for the current scroll position too
    const scrollTarget = document.body.scrollTop + anchorElement.getBoundingClientRect().top - 8;
    performScroll(t => scrollTarget * t);

    return true;
  }
}
