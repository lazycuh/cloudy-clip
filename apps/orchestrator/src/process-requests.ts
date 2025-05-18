import { ExceptionCode, ExceptionPayload, ResponseBody } from '@lazycuh/http';

import { createJsonResponse, HttpStatusCode } from './common/http';

export const onRequest: PagesFunction<Env> = async context => {
  const request = context.request;
  const headers = new Headers(request.headers);

  if (__ENVIRONMENT__ === 'development') {
    headers.set('CF-Connecting-IP', '127.0.0.1');
    headers.set('X-Forwarded-For', '127.0.0.1');
  } else {
    const connectingIp = headers.get('CF-Connecting-IP');

    if (!connectingIp) {
      return createJsonResponse(
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        // eslint-disable-next-line @stylistic/quotes
        new ResponseBody(null, "could not locate client's IP")
      );
    }

    headers.set('X-Forwarded-For', connectingIp);
  }

  const url = new URL(request.url);

  try {
    if (url.pathname.startsWith('/api')) {
      return await fetch(`${__UPSTREAM__}${url.pathname}${url.search}`, new Request(request, { headers }));
    }

    return await context.env.ASSETS.fetch(url);
  } catch {
    const exceptionPayload: ExceptionPayload = {
      code: ExceptionCode.UNKNOWN,
      requestId: btoa(String(Math.random() + Math.random())),
      requestMethod: request.method,
      requestPath: `${url.pathname}${url.search}`,
      timestamp: new Date().toISOString()
    };

    return createJsonResponse(
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      new ResponseBody(exceptionPayload, 'an unknown error has occurred')
    );
  }
};
