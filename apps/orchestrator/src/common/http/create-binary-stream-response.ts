import { ContentType } from './content-type';
import { createResponse } from './create-response';
import { HttpStatusCode } from './http-status-code';

export function createBinaryStreamResponse(dataStream: ArrayBuffer): Response {
  return createResponse(dataStream, HttpStatusCode.OK, ContentType.APPLICATION_OCTET_STREAM);
}
