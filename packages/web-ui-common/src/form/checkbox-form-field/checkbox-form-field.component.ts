import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'checkbox-form-field'
  },
  imports: [MatCheckboxModule, ReactiveFormsModule],
  selector: 'lc-checkbox-form-field',
  styleUrl: './checkbox-form-field.component.scss',
  templateUrl: './checkbox-form-field.component.html'
})
export class CheckboxFormFieldComponent {
  readonly control = input.required<FormControl<boolean>>();
}
