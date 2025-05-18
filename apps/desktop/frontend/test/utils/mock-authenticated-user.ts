import { Optional } from '@lazycuh/optional';
import { vi } from 'vitest';

import { UserService } from '@lazycuh/web-ui-common/auth';
import { Plan } from '@lazycuh/web-ui-common/entitlement';

import { deepCloneObject } from './deep-clone-object';
import { generateAuthenticatedUser } from './generate-authenticated-user';

export function mockAuthenticatedUser(plan?: Plan) {
  const user = deepCloneObject(generateAuthenticatedUser(plan));

  vi.spyOn(UserService.prototype, 'getAuthenticatedUser').mockReturnValue(user);
  vi.spyOn(UserService.prototype, 'findAuthenticatedUser').mockReturnValue(Optional.of(user));
  vi.spyOn(UserService.prototype, 'isUserAlreadyLoggedIn').mockReturnValue(true);

  return user;
}
