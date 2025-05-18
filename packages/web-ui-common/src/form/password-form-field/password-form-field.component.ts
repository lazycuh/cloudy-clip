import { ChangeDetectionStrategy, Component, input, signal, ViewEncapsulation } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { TooltipDirective } from '@lazycuh/angular-tooltip';

import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { IconComponent } from '@lazycuh/web-ui-common/icon';

import { FormFieldComponent } from '../form-field';
import { PASSWORD_RULES } from '../validators';

@Component({
  animations: [fadeIn({ duration: '0.25s', name: 'password-rule' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.show-password-rules]': 'showPasswordRules()',
    class: 'password-form-field'
  },
  imports: [FormFieldComponent, ReactiveFormsModule, IconComponent, TooltipDirective, MatRipple],
  selector: 'lc-password-form-field',
  styleUrl: './password-form-field.component.scss',
  templateUrl: './password-form-field.component.html'
})
export class PasswordFormFieldComponent {
  readonly control = input.required<FormControl<string>>();
  readonly autocomplete = input.required<HTMLInputElement['autocomplete']>();

  readonly label = input($localize`Password`);
  readonly placeholder = input('');
  readonly showPasswordRules = input(false);

  protected readonly _passwordVisible = signal(false);

  protected readonly _passwordRules = PASSWORD_RULES;

  protected _hasError(validatorFunctionName: string) {
    return (
      this.control().touched && (this.control().hasError(validatorFunctionName) || this.control().hasError('required'))
    );
  }

  protected _isRuleValid(validatorFunctionName: string) {
    return (
      this.control().dirty && !this.control().hasError(validatorFunctionName) && !this.control().hasError('required')
    );
  }

  protected _togglePasswordFieldVisibility() {
    this._passwordVisible.update(passwordVisible => !passwordVisible);
  }
}
