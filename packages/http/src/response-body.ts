export class ResponseBody<T> {
  constructor(
    readonly payload: T,
    readonly message = 'OK'
  ) {}
}
