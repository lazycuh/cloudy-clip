import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { type FormControl, ReactiveFormsModule } from '@angular/forms';

import { FormFieldComponent } from '../form-field';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'short-text-form-field'
  },
  imports: [FormFieldComponent, ReactiveFormsModule],
  selector: 'lc-short-text-form-field',
  styleUrl: './short-text-form-field.component.scss',
  templateUrl: './short-text-form-field.component.html'
})
export class ShortTextFormFieldComponent {
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<string>>();
  readonly autocomplete = input.required<HTMLInputElement['autocomplete']>();
  readonly type = input.required<'text' | 'email' | 'search'>();

  readonly placeholder = input('');
}
