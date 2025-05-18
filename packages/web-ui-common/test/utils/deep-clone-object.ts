export function deepCloneObject<T extends object>(object: T): T {
  return JSON.parse(JSON.stringify(object)) as T;
}
