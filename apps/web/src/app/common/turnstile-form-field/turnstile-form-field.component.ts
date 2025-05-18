import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  OnDestroy,
  signal,
  viewChild,
  ViewEncapsulation
} from '@angular/core';
import { type FormControl } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { Logger } from '@lazycuh/logging';
import { InfoBoxComponent } from '@lazycuh/web-ui-common/message-box/info-box';
import { WarningBoxComponent } from '@lazycuh/web-ui-common/message-box/warning-box';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.turnstile-crashed]': '_didTurnstileWidgetCrash()',
    '[class.turnstile-stuck]': '_isTurnstileStuck()',
    class: 'turnstile-form-field'
  },
  imports: [WarningBoxComponent, MatRipple, PulseLoaderComponent, InfoBoxComponent],
  selector: 'lc-turnstile-form-field',
  styleUrl: './turnstile-form-field.component.scss',
  templateUrl: './turnstile-form-field.component.html'
})
export class TurnstileFormFieldComponent implements OnDestroy {
  readonly control = input.required<FormControl<string | null | undefined>>();
  readonly action = input.required<string>();

  protected readonly _isSettingUpTurnstile = signal(true);
  protected readonly _didTurnstileWidgetCrash = signal(false);
  protected readonly _isTurnstileStuck = signal(false);

  private readonly _turnstileMount = viewChild.required<string, ElementRef<HTMLElement>>('turnstileMount', {
    read: ElementRef
  });

  private readonly _turnstileOptions = {
    action: '',
    appearance: 'always',
    'before-interactive-callback': () => {
      clearTimeout(this._turnstileTimeoutHandle);
    },
    callback: (token: string) => {
      this._didTurnstileWidgetCrash.set(false);
      this._isTurnstileStuck.set(false);
      clearTimeout(this._turnstileTimeoutHandle);
      this.control().setValue(token);
      this.control().markAsDirty();
      this.control().markAsTouched();
    },
    'error-callback': (errorCode: string): boolean => {
      new Logger('TurnstileFormFieldComponent').error('turnstile widget has encountered an error', errorCode);

      this._handleTurnstileWidgetFailure();

      // Returning false causes Turnstile to log error code as a console warning.
      return false;
    },
    'expired-callback': () => {
      new Logger('TurnstileFormFieldComponent').warn('turnstile widget has expired');

      this._handleTurnstileWidgetFailure();

      window.turnstile.reset(this._widgetId);
    },
    language: $localize`en`,
    retry: 'never',
    sitekey: '0x4AAAAAAAi7PkNVuc9K_M9Z',
    theme: 'dark',
    'timeout-callback': () => {
      new Logger('TurnstileFormFieldComponent').warn('turnstile widget has timed out');

      this._handleTurnstileWidgetFailure();

      window.turnstile.reset(this._widgetId);
    }
  };

  private _widgetId = '';
  private _turnstileTimeoutHandle = -1;

  constructor() {
    afterNextRender({
      write: () => {
        if (!__IS_TEST__) {
          this._turnstileOptions.action = this.action();
          this._initTurnstile();
        } else {
          setTimeout(() => {
            this._turnstileOptions.callback('test-token');
          });
        }
      }
    });
  }

  private _handleTurnstileWidgetFailure() {
    this._didTurnstileWidgetCrash.set(true);
    this._isTurnstileStuck.set(false);
    clearTimeout(this._turnstileTimeoutHandle);

    this.control().setValue('');
    this.control().updateValueAndValidity();
  }

  private _initTurnstile() {
    this._turnstileTimeoutHandle = window.setTimeout(() => {
      this._isTurnstileStuck.set(true);
    }, 5000);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (window.turnstile) {
      this._onRetry();

      return;
    }

    const script = document.createElement('script');
    const turnstileCallbackName = 'onloadTurnstileCallback';
    // eslint-disable-next-line max-len
    script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=${turnstileCallbackName}`;
    script.async = true;
    script.defer = true;

    window[turnstileCallbackName] = () => {
      this._renderTurnstileWidget();
    };

    document.head.appendChild(script);
  }

  private _renderTurnstileWidget() {
    this._widgetId = window.turnstile.render(this._turnstileMount().nativeElement, this._turnstileOptions);
    this._isSettingUpTurnstile.set(false);
  }

  ngOnDestroy() {
    if (this._widgetId) {
      window.turnstile.remove(this._widgetId);
    }
  }

  protected _onRetry() {
    this._didTurnstileWidgetCrash.set(false);
    this._isTurnstileStuck.set(false);
    this.control().reset('');

    if (this._widgetId !== '') {
      window.turnstile.reset(this._widgetId);
    } else {
      this._renderTurnstileWidget();
    }
  }
}
