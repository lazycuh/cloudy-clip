import { AuthenticatedUser, UserStatusReason } from '@lazycuh/web-ui-common/auth';
import { Plan } from '@lazycuh/web-ui-common/entitlement';

export function generateAuthenticatedUser(plan?: Plan): AuthenticatedUser {
  const now = new Date();

  return Object.freeze({
    createdAt: now.toISOString(),
    displayName: 'Hello World',
    email: 'helloworld@gmail.com',
    lastLoggedInAt: now.toISOString(),
    provider: '',
    status: 'ACTIVE',
    statusReason: UserStatusReason.NONE,
    subscription: plan
      ? Object.freeze({ canceledAt: null, cancellationReason: null, plan: Object.freeze(plan) })
      : null,
    updatedAt: now.toISOString()
  });
}
