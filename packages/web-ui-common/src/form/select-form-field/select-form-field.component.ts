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
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatOption } from '@angular/material/autocomplete';

import { FormFieldComponent } from '../form-field';

import { SelectOption } from './select-option';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'select-form-field'
  },
  imports: [FormFieldComponent, ReactiveFormsModule, MatAutocompleteModule, MatOption],
  selector: 'lc-select-form-field',
  styleUrl: './select-form-field.component.scss',
  templateUrl: './select-form-field.component.html'
})
export class SelectFormFieldComponent<T> {
  readonly label = input.required<string>();
  readonly options = input.required<Array<SelectOption<T>> | Readonly<Array<SelectOption<T>>>>();
  readonly control = input.required<FormControl<T>>();

  readonly placeholder = input('');

  protected readonly _controlForOptionLabelInput = new FormControl<string>('', {
    nonNullable: true,
    validators: Validators.required
  });

  protected readonly _filteredOptions = signal<Array<SelectOption<T>> | Readonly<Array<SelectOption<T>>>>([]);

  private _wasAnOptionSelected = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      write: () => {
        const foundOption = this._findOptionForValue(this.control().value);

        if (foundOption) {
          this._controlForOptionLabelInput.setValue(foundOption.label);
        }

        this._controlForOptionLabelInput.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe({
          next: value => {
            this._wasAnOptionSelected = false;

            this.control().setErrors(this._controlForOptionLabelInput.errors);

            this._filteredOptions.set(
              this.options().filter(option => option.label.toLowerCase().includes(value.toLowerCase()))
            );
          }
        });
      }
    });
  }

  private _findOptionForValue(value: T) {
    return this.options().find(option => option.value === value) ?? null;
  }

  protected _selectOptionOnUserBehalf(event: Event) {
    setTimeout(() => {
      if (this._wasAnOptionSelected || event.target === document.activeElement) {
        return;
      }

      // If the filtered option list only contains one element, then
      // we want to automatically select it.
      if (this._filteredOptions().length === 1) {
        const option = this._filteredOptions()[0]!;
        this.control().setValue(option.value);
        this.control().markAsDirty();
        this._controlForOptionLabelInput.setValue(option.label);
        this._wasAnOptionSelected = true;
      } else {
        const previouslySelectedOption = this._findOptionForValue(this.control().value);

        if (previouslySelectedOption) {
          this._controlForOptionLabelInput.setValue(previouslySelectedOption.label);
          this._wasAnOptionSelected = true;
        }
      }
    }, 250);
  }

  protected _onSelectionChange(event: MatAutocompleteSelectedEvent) {
    this._wasAnOptionSelected = true;

    const selectedValue = event.option.value as T;

    this.control().setValue(selectedValue);
    this._controlForOptionLabelInput.setValue(event.option.getLabel());
  }
}
