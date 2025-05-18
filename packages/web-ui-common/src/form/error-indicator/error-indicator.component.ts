import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'error-indicator'
  },
  imports: [],
  selector: 'lc-error-indicator',
  styleUrl: './error-indicator.component.scss',
  templateUrl: './error-indicator.component.html'
})
export class ErrorIndicatorComponent {
  readonly control = input.required<FormControl<unknown>>();

  readonly label = input('This field');

  protected readonly _errorToShow = signal('');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      read: () => {
        this.control()
          .events.pipe(takeUntilDestroyed(destroyRef))
          .subscribe({
            next: () => {
              this._errorToShow.set(this._getFirstError());
            }
          });
      }
    });
  }

  protected _getFirstError(): string {
    const control = this.control();
    const errors = control.errors;

    if (control.touched && errors) {
      const label = this.label();

      const sortedErrors = Object.entries(errors).sort((leftEntry, rightEntry) => {
        if (leftEntry[0] === 'required') {
          return -1;
        }

        if (rightEntry[0] === 'required') {
          return 1;
        }

        return 0;
      });

      const firstError = sortedErrors[0]!;

      switch (firstError[0]) {
        case 'required':
          return $localize`${label} is required`;
        case 'email':
          return $localize`${label} is not valid`;
        case 'min':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return $localize`${label} must be greater than or equal to ${firstError[1].min}`;
        case 'minlength':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return $localize`${label} must contain at least ${firstError[1].requiredLength} characters`;
        case 'max':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return $localize`${label} must be less than or equal to ${firstError[1].max}`;
        case 'maxlength':
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          return $localize`${label} must contain at most ${firstError[1].requiredLength} characters`;
        default:
          return firstError[1];
      }
    }

    return '';
  }
}
