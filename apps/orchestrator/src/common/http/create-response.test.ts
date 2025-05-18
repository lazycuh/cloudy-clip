import { describe, expect, it } from 'vitest';

import { createResponse } from './create-response';
import { HttpStatusCode } from './http-status-code';

describe('createResponse()', () => {
  it('Should return 204 response with no body when undefined is provided for body', async () => {
    const response = createResponse(undefined);

    expect(response.status).toEqual(HttpStatusCode.NO_CONTENT);
    expect(await response.text()).toEqual('');
  });
});
