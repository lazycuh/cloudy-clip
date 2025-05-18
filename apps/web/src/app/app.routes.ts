import { inject } from '@angular/core';
import { GuardResult, MaybeAsync, RedirectCommand, Router, Routes } from '@angular/router';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { GlobalStateStore } from '@lazycuh/web-ui-common/state-store';

import { LandingPageComponent } from './landing-page';

export const routes: Routes = [
  {
    loadComponent: () =>
      import('./account-registration/account-registration-request').then(m => m.AccountRegistrationRequestComponent),
    path: 'account/registration',
    pathMatch: 'full'
  },
  {
    loadComponent: () =>
      import('./account-registration/account-registration-verification').then(
        m => m.AccountRegistrationVerificationComponent
      ),
    path: 'account/registration/verification',
    pathMatch: 'full'
  },
  {
    loadComponent: () => import('./account-reset/password-reset-request').then(m => m.PasswordResetRequestComponent),
    path: 'account/reset',
    pathMatch: 'full'
  },
  {
    loadComponent: () =>
      import('./account-reset/password-reset-verification').then(m => m.PasswordResetVerificationComponent),
    path: 'account/reset/verification',
    pathMatch: 'full'
  },
  {
    canActivate: [isUserLoggedInGuard],
    loadComponent: () => import('./pricing/checkout').then(m => m.CheckoutComponent),
    path: 'checkout',
    pathMatch: 'full'
  },
  {
    loadComponent: () => import('./error/not-found-error').then(m => m.NotFoundErrorComponent),
    path: 'errors/not-found'
  },
  {
    loadComponent: () => import('./error/unknown-error').then(m => m.UnknownErrorComponent),
    path: 'errors/unknown'
  },
  {
    loadComponent: () => import('./login-page').then(m => m.LoginPageComponent),
    path: 'login',
    pathMatch: 'full'
  },
  {
    loadComponent: () => import('./login-page').then(m => m.LoginPageComponent),
    path: 'login/oauth2/discord',
    pathMatch: 'full'
  },
  {
    loadComponent: () => import('./login-page').then(m => m.LoginPageComponent),
    path: 'login/oauth2/facebook',
    pathMatch: 'full'
  },
  {
    loadComponent: () => import('./login-page').then(m => m.LoginPageComponent),
    path: 'login/oauth2/google',
    pathMatch: 'full'
  },
  {
    canActivate: [isUserLoggedInGuard],
    children: [
      {
        loadComponent: () => import('./user-dashboard/account').then(m => m.AccountComponent),
        path: 'account',
        pathMatch: 'full'
      },
      {
        loadComponent: () => import('./user-dashboard/billing-history').then(m => m.BillingHistoryComponent),
        path: 'billing',
        pathMatch: 'full'
      },
      {
        loadComponent: () => import('./user-dashboard/subscription').then(m => m.SubscriptionComponent),
        path: 'subscription',
        pathMatch: 'full'
      },
      {
        loadComponent: () => import('./user-dashboard/payment-method-list').then(m => m.PaymentMethodListComponent),
        path: 'payment-methods',
        pathMatch: 'full'
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'account'
      }
    ],
    loadComponent: () => import('./user-dashboard').then(m => m.UserDashboardComponent),
    path: 'my',
    pathMatch: 'prefix'
  },
  {
    loadComponent: () => import('./pricing/plan-list').then(m => m.PlanListComponent),
    path: 'pricing',
    pathMatch: 'full'
  },
  {
    loadComponent: () => import('./policies/privacy-policy').then(m => m.PrivacyPolicyComponent),
    path: 'policies/privacy-policy',
    pathMatch: 'full'
  },
  {
    loadComponent: () => import('./policies/refund-policy').then(m => m.RefundPolicyComponent),
    path: 'policies/refund-policy',
    pathMatch: 'full'
  },
  {
    loadComponent: () => import('./policies/terms-of-service').then(m => m.TermsOfServiceComponent),
    path: 'policies/terms-of-service',
    pathMatch: 'full'
  },
  {
    canActivate: [isUserLoggedInGuard],
    loadComponent: () => import('./pricing/purchase-confirmation').then(m => m.PurchaseConfirmationComponent),
    path: 'purchase/confirmation',
    pathMatch: 'full'
  },

  {
    component: LandingPageComponent,
    path: '',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'errors/not-found'
  }
];

async function isUserLoggedInGuard(): Promise<MaybeAsync<GuardResult>> {
  const router = inject(Router);
  const userService = inject(UserService);
  const globalStateStore = inject(GlobalStateStore);

  const sessionRestored = await userService.restoreSession();

  if (sessionRestored) {
    return true;
  }

  const currentNavigation = router.getCurrentNavigation();

  globalStateStore.update(
    {
      interceptedRoute: {
        path: currentNavigation?.extractedUrl.toString() ?? '/',
        state: currentNavigation?.extras.state ?? null
      }
    },
    { persistent: true }
  );

  const loginPath = router.parseUrl('/login');

  return new RedirectCommand(loginPath, { replaceUrl: true });
}
