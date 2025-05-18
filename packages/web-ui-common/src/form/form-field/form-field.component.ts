import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  input,
  Renderer2,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators, ValueChangeEvent } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { TooltipDirective } from '@lazycuh/angular-tooltip';

import { IconComponent } from '../../icon';
import { generateRandomString } from '../../utils/generate-random-string';
import { ErrorIndicatorComponent } from '../error-indicator';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.invalid-input]': '_isInvalid()',
    '[class.is-disabled]': '_isDisabled()',
    '[class.is-required]': '_isRequired()',
    class: 'form-field'
  },
  imports: [IconComponent, ErrorIndicatorComponent, MatRipple, TooltipDirective],
  selector: 'lc-form-field',
  styleUrl: './form-field.component.scss',
  templateUrl: './form-field.component.html'
})
export class FormFieldComponent<T> {
  readonly label = input.required<string>();
  readonly control = input.required<FormControl<T>>();

  readonly hasPlaceholder = input(true);

  protected readonly _hasFocus = signal(false);
  protected readonly _shouldShowClearButton = signal(false);
  protected readonly _isInvalid = signal(false);
  protected readonly _isDisabled = signal(false);
  protected readonly _clearButtonAriaLabel = computed(() => $localize`Clear ${this.label()} form field`);
  protected readonly _isRequired = computed(() => this.control().hasValidator(Validators.required));
  protected readonly _inputId = generateRandomString();

  private readonly _inputElementRef = contentChild.required<ElementRef<HTMLInputElement>>('inputElement');
  private readonly _renderer = inject(Renderer2);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      read: () => {
        this._isDisabled.set(this.control().disabled);
        this._shouldShowClearButton.set(Boolean(this.control().value));

        this.control()
          .events.pipe(takeUntilDestroyed(destroyRef))
          .subscribe({
            next: event => {
              if (event instanceof ValueChangeEvent) {
                this._shouldShowClearButton.set((event.value as string).length > 0);
              }

              this._isInvalid.set(event.source.invalid && event.source.touched);
              this._isDisabled.set(event.source.disabled);
            }
          });

        this._inputElementRef().nativeElement.id = this._inputId;
        this._inputElementRef().nativeElement.name = this.label().toLowerCase().replace(/\s+/g, '-');
      }
    });
  }

  focus() {
    this._hasFocus.set(true);
    this._renderer.setAttribute(document.body, 'data-has-keyboard-focus', 'true');
  }

  blur() {
    this._hasFocus.set(false);
    this._renderer.setAttribute(document.body, 'data-has-keyboard-focus', 'false');
  }

  clear() {
    this.control().setValue('' as T);
    this._inputElementRef().nativeElement.focus();
  }
}
