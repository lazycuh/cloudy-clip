import { ChangeDetectionStrategy, Component, input, output, ViewEncapsulation } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import { generateRandomString } from '../../utils/generate-random-string';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'lc-form-container'
  },
  imports: [ReactiveFormsModule],
  selector: 'lc-form',
  styleUrl: './form.component.scss',
  templateUrl: './form.component.html'
})
export class FormComponent {
  readonly form = input.required<FormGroup>();

  readonly formTitle = input.required<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly submitForm = output<any>();

  protected readonly _formId = generateRandomString();

  protected _onSubmit() {
    const form = this.form();

    if (form.valid && form.dirty) {
      this.submitForm.emit(form.value);
    }
  }
}
