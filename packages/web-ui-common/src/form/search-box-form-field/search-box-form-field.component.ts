import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';

import { FormComponent } from '../form';
import { ShortTextFormFieldComponent } from '../short-text-form-field';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'search-box-form-field'
  },
  imports: [FormComponent, ShortTextFormFieldComponent],
  selector: 'lc-search-box-form-field',
  styleUrl: './search-box-form-field.component.scss',
  templateUrl: './search-box-form-field.component.html'
})
export class SearchBoxFormFieldComponent {
  readonly label = input.required<string>();

  readonly placeholder = input('');
  readonly disabled = input(false);

  readonly valueChange = output<string>();

  protected readonly _form = new FormGroup({
    searchTerm: new FormControl('')
  });

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      if (this.disabled()) {
        this._form.disable();
      } else {
        this._form.enable();
      }
    });

    afterNextRender({
      read: () => {
        this._findSearchBoxFormControl()
          .valueChanges.pipe(takeUntilDestroyed(destroyRef))
          .subscribe({
            next: newValue => {
              if (newValue === '') {
                this.valueChange.emit(newValue);
              }
            }
          });
      }
    });
  }

  protected _findSearchBoxFormControl() {
    return this._form.get('searchTerm') as FormControl<string>;
  }

  protected _onSearch() {
    this.valueChange.emit(this._form.value.searchTerm?.trim() ?? '');
  }
}
