export class MissingValueError extends Error {
  constructor() {
    super('No value is present in optional');
  }
}
