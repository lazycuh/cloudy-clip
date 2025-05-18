import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  signal,
  TemplateRef,
  ViewEncapsulation
} from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatRipple } from '@angular/material/core';

import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { BackdropComponent } from '@lazycuh/web-ui-common/backdrop';
import { slideUp } from '@lazycuh/web-ui-common/effect/slide-up';
import { FocusBoxComponent } from '@lazycuh/web-ui-common/focus-box';
import { CheckboxFormFieldComponent } from '@lazycuh/web-ui-common/form/checkbox-form-field';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';

import { ButtonSpec } from '../button-spec';

@Component({
  animations: [
    slideUp({ duration: '500ms', from: '32px', leavingTransition: '* => false', name: 'slide-up', to: '0' })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '(@slide-up.done)': '_onAfterClosed()',
    '[@slide-up]': '_isOpen()',
    '[class]': 'className()',
    class: 'dialog-template'
  },
  imports: [
    FocusBoxComponent,
    ActionContainerComponent,
    NgTemplateOutlet,
    MatRipple,
    CheckboxFormFieldComponent,
    PulseLoaderComponent,
    BackdropComponent
  ],
  selector: 'lc-dialog-template',
  styleUrl: './dialog-template.component.scss',
  templateUrl: './dialog-template.component.html'
})
export class DialogTemplateComponent {
  readonly className = input.required<string>();
  readonly title = input.required<string>();
  readonly content = input.required<TemplateRef<unknown>>();
  readonly buttons = input.required<ButtonSpec[]>();

  readonly consent = input<string>();

  protected readonly _isOpen = signal(true);
  protected readonly _consentCheckboxFormControl = new FormControl(false, {
    nonNullable: true,
    validators: Validators.requiredTrue
  });

  protected _onAfterClosedFn?: VoidFunction;

  private _dismissible = true;

  @HostListener('window:keyup.Escape')
  close() {
    if (this._dismissible) {
      this._isOpen.set(false);
    }
  }

  setOnAfterClosed(fn: VoidFunction) {
    this._onAfterClosedFn = fn;
  }

  protected _onAfterClosed() {
    if (!this._isOpen()) {
      this._onAfterClosedFn?.();
      /*
       * Angular somehow calls this again after the component is created the second time onwards
       * with `_isOpen() === false`, so we set `_onAfterClosedFn` to `undefined` to prevent it
       * from being run again.
       */
      this._onAfterClosedFn = undefined;
    }
  }

  protected _isButtonDisabled(buttonSpec: ButtonSpec) {
    return (
      buttonSpec.state?.() === 'DISABLED' ||
      (buttonSpec.requiresConsent === true && !this._consentCheckboxFormControl.value) ||
      this._isButtonLoading(buttonSpec)
    );
  }

  protected _isButtonLoading(buttonSpec: ButtonSpec) {
    return buttonSpec.state?.() === 'LOADING';
  }

  nonDismissble() {
    this._dismissible = false;
  }
}
