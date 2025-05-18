import { ResponseBody } from '@lazycuh/http';
import { describe, expect, it } from 'vitest';

import { ContentType } from './content-type';
import { createJsonResponse } from './create-json-response';
import { HeaderName } from './header-name';
import { HttpStatusCode } from './http-status-code';

describe('createJsonResponse()', () => {
  it('Should include the expected response headers', () => {
    const response = createJsonResponse(HttpStatusCode.CREATED, new ResponseBody({ message: 'Hello World' }));

    expect(response.headers.get(HeaderName.CONTENT_TYPE)).toEqual(ContentType.APPLICATION_JSON);
    expect(response.headers.get(HeaderName.ACCESS_CONTROL_ALLOW_ORIGIN)).toEqual(__ACCESS_CONTROL_ALLOW_ORIGIN__);
  });

  it('Should return response with the provided body', async () => {
    const responseBodyPayload = { hello: 'world' };
    const response = createJsonResponse(HttpStatusCode.OK, new ResponseBody(responseBodyPayload));

    expect(response.status).toEqual(HttpStatusCode.OK);
    expect(await response.json()).toEqual(new ResponseBody(responseBodyPayload));
  });
});
