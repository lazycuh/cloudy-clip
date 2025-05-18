declare namespace NodeJS {
  export interface ProcessEnv {}
}

declare type Type<T = unknown> = new (...args: unknown[]) => T;

declare type Json = boolean | number | string | null | Json[] | { [x: string]: Json };
