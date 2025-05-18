import { ExceptionCode } from './exception-code';

export interface ExceptionPayload {
  readonly code: ExceptionCode;
  readonly extra?: Record<string, Json>;
  readonly requestId: string;
  readonly requestMethod: string;
  readonly requestPath: string;
  readonly timestamp: string;
}
