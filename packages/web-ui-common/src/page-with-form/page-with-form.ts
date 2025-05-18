import { afterNextRender, DestroyRef, Directive, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormSubmittedEvent } from '@angular/forms';
import { filter } from 'rxjs';

@Directive()
export abstract class PageWithForm {
  protected abstract readonly _form: FormGroup;

  protected abstract _clearForm(): void;

  protected readonly _shouldDisableSubmitButton = signal(true);
  protected readonly _shouldDisableClearButton = signal(true);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      read: () => {
        if (!this._form.controls.turnstile) {
          throw new Error('Form should have a control named "turnstile"');
        }

        this._form.events
          .pipe(
            takeUntilDestroyed(destroyRef),
            filter(event => !(event instanceof FormSubmittedEvent))
          )
          .subscribe({
            next: () => {
              this._shouldDisableSubmitButton.set((this._form.invalid && this._form.dirty) || this._form.pristine);
              this._shouldDisableClearButton.set(this._form.pristine || this._isFormValueEmpty());
            }
          });
      }
    });
  }

  private _isFormValueEmpty() {
    for (const [controlName, value] of Object.entries(this._form.value as Record<string, unknown>)) {
      if (controlName === 'turnstile') {
        continue;
      }

      if (typeof value === 'string' && value !== '') {
        return false;
      }
    }

    return true;
  }

  protected _onClearForm() {
    const turnstileControl = this._form.controls.turnstile as FormControl;

    const turnstileToken = turnstileControl.value as string;

    this._clearForm();

    turnstileControl.setValue(turnstileToken);
  }
}
