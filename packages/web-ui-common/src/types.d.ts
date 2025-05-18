type NotNullable<T> = { [P in keyof Required<T>]: NonNullable<T[P]> };
type Nullable<T> = { [P in keyof Required<T>]: T[P] | null };

declare const __IS_TEST__: boolean;
declare const __ORCHESTRATOR_URL__: string;
declare const __ORIGIN__: string;
