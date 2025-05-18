type NotNullable<T> = { [P in keyof Required<T>]: NonNullable<T[P]> };
type Nullable<T> = { [P in keyof Required<T>]: T[P] | null };

type FormControlNameList<T extends import('@angular/forms').FormGroup> = keyof T['controls'];
type FormControlType<T extends import('@angular/forms').FormGroup, K extends FormControlNameList<T>> = T['controls'][K];
type FormValue<T extends import('@angular/forms').FormGroup> = Required<T['value']>;

declare const __IS_TEST__: boolean;
declare const __ORCHESTRATOR_URL__: string;
declare const __ORIGIN__: string;
