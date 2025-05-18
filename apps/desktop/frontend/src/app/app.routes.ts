import { inject } from '@angular/core';
import { GuardResult, MaybeAsync, RedirectCommand, Router, Routes } from '@angular/router';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { GlobalStateStore } from '@lazycuh/web-ui-common/state-store';

export const routes: Routes = [];

export async function isUserLoggedInGuard(): Promise<MaybeAsync<GuardResult>> {
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
