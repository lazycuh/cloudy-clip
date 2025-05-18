import { HttpErrorResponse } from '@angular/common/http';
import { ExceptionCode, ExceptionPayload, ResponseBody } from '@lazycuh/http/src';

import { generateRandomString } from './generate-random-string';

export function getErrorInfo(error: unknown): ResponseBody<ExceptionPayload> {
  if (error instanceof HttpErrorResponse) {
    return error.error as ResponseBody<ExceptionPayload>;
  }

  return new ResponseBody(
    {
      code: ExceptionCode.UNKNOWN,
      extra: { originalStacktrace: (error as Error).stack ?? '' },
      requestId: generateRandomString(),
      requestMethod: '',
      requestPath: '',
      timestamp: new Date().toISOString()
    },
    (error as Error).message
  );
}
