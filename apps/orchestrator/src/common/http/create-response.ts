import { ContentType } from './content-type';
import { HeaderName } from './header-name';
import { HttpStatusCode } from './http-status-code';

export function createResponse(responseBody: undefined): Response;

export function createResponse(
  responseBodyPayload: BodyInit,
  statusCode: HttpStatusCode,
  contentType: ContentType,
  cookies?: string[]
): Response;

export function createResponse(
  responseBodyPayload: BodyInit | undefined,
  statusCode?: HttpStatusCode,
  contentType?: ContentType
): Response {
  const headers = new Headers({
    [HeaderName.ACCESS_CONTROL_ALLOW_ORIGIN]: __ACCESS_CONTROL_ALLOW_ORIGIN__
  });

  if (contentType !== undefined) {
    headers.set(HeaderName.CONTENT_TYPE, contentType);
  }

  return new Response(responseBodyPayload, {
    headers,
    status: responseBodyPayload !== undefined ? statusCode : HttpStatusCode.NO_CONTENT
  });
}
