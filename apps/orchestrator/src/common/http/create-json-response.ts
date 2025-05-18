import { ResponseBody } from '@lazycuh/http';

import { ContentType } from './content-type';
import { createResponse } from './create-response';
import { HttpStatusCode } from './http-status-code';

export function createJsonResponse<T>(statusCode: HttpStatusCode, responseBody: ResponseBody<T>): Response {
  return createResponse(JSON.stringify(responseBody), statusCode, ContentType.APPLICATION_JSON);
}
