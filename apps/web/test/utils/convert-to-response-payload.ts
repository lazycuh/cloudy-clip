import { ExceptionPayload, ResponseBody } from '@lazycuh/http/src';

export function convertToResponsePayload(payload: unknown, message = 'OK'): ResponseBody<unknown> {
  return new ResponseBody(payload, message);
}

export function convertToErrorResponsePayload(payload: Partial<ExceptionPayload>, message = 'expected') {
  return new ResponseBody(payload, message);
}
