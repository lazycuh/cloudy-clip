import { COMMA, ENTER } from '@angular/cdk/keycodes';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipGrid, MatChipInput, MatChipInputEvent, MatChipRemove, MatChipRow } from '@angular/material/chips';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { TooltipDirective } from '@lazycuh/angular-tooltip';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

import { IconComponent } from '@lazycuh/web-ui-common/icon';

import { ErrorIndicatorComponent } from '../error-indicator';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'chip-form-field form-field'
  },
  imports: [
    MatFormField,
    MatLabel,
    MatChipGrid,
    MatChipRow,
    MatChipRemove,
    MatChipInput,
    MatSuffix,
    IconComponent,
    TooltipDirective,
    ReactiveFormsModule,
    MatAutocompleteModule,
    ErrorIndicatorComponent
  ],
  selector: 'lc-chip-form-field',
  styleUrl: './chip-form-field.component.scss',
  templateUrl: './chip-form-field.component.html'
})
export class ChipFormFieldComponent {
  readonly control = input.required<FormControl<string[]>>();
  readonly autocompleteSource = input.required<string[]>();
  readonly label = input.required<string>();

  readonly appearance = input<MatFormField['appearance']>('outline');
  readonly initialChips = input<string[]>();
  readonly placeholder = input('');
  readonly autofocus = input<boolean>();

  readonly typing = output<string>();

  protected readonly _chipTerminationKeyCodes = [ENTER, COMMA];
  protected readonly _chipInputFormControl = new FormControl('');

  protected _addedChips = signal<string[]>([]);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      read: () => {
        this._chipInputFormControl.valueChanges
          .pipe(
            takeUntilDestroyed(destroyRef),
            debounceTime(250),
            distinctUntilChanged(),
            map(enteredValue => enteredValue?.trim() ?? '')
          )
          .subscribe({
            next: enteredValue => {
              this.typing.emit(enteredValue);
            }
          });

        this._addedChips.set(this.initialChips() ?? []);
      }
    });
  }

  protected _onRemoveChip(chip: string) {
    this._addedChips.update(addedChips => addedChips.filter(addedChip => chip !== addedChip));
    this._updateFormControlValue();
  }

  private _updateFormControlValue() {
    const control = this.control();
    control.setValue(this._addedChips());
    control.root.markAsDirty();
    control.root.markAsTouched();
  }

  protected _onAddChip(event: MatChipInputEvent | MatAutocompleteSelectedEvent, chipInput: HTMLInputElement) {
    const selectedChip = 'value' in event ? (event.value || '').trim() : (event.option.value as string);

    if (selectedChip.length > 0) {
      this._addedChips.update(addedChips => [...addedChips, selectedChip]);
      this._updateFormControlValue();

      if ('chipInput' in event) {
        event.chipInput.clear();
      }
    }

    this._chipInputFormControl.setValue('');
    chipInput.value = '';
  }

  protected _onValidateControl() {
    const control = this.control();
    control.markAsTouched();
    this._chipInputFormControl.setErrors(control.validator?.(control) ?? null);
  }

  protected _onClearFormField(inputElement: HTMLInputElement) {
    this._chipInputFormControl.setValue('');
    inputElement.value = '';
  }
}
