import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  linkedSignal,
  output,
  ViewEncapsulation
} from '@angular/core';
import { MatRippleModule } from '@angular/material/core';

import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { ClickEventBubblingStopper } from '@lazycuh/web-ui-common/utils/click-event-bubbling-stopper';
import { Debounced } from '@lazycuh/web-ui-common/utils/debounced';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'number-input'
  },
  imports: [IconComponent, MatRippleModule],
  selector: 'lc-number-input',
  styleUrls: ['./number-input.component.scss'],
  templateUrl: './number-input.component.html'
})
export class NumberInputComponent extends ClickEventBubblingStopper {
  readonly value = input.required<number>();

  readonly min = input(0);

  readonly valueChange = output<number>();

  protected readonly _currentValue = linkedSignal(this.value);

  private _autoValueUpdateIntervalId = -1;
  private _autoValueUpdateStartTimestamp = -1;

  protected _onBlur(event: Event) {
    const inputElement = event.target as HTMLInputElement;

    if (!inputElement.validity.valid) {
      inputElement.value = String(this._currentValue());
    } else {
      inputElement.value = String(this._constraintNewValue(this._currentValue()));
    }
  }

  private _constraintNewValue(newValue: number) {
    return Math.max(this.min(), newValue);
  }

  @Debounced(500)
  protected _onValueChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;

    if (inputElement.validity.valid) {
      this._updateValue(Number(inputElement.value));
    }
  }

  private _updateValue(value: number) {
    value = this._constraintNewValue(value);
    this._currentValue.set(value);
    this.valueChange.emit(value);
  }

  protected _onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowUp') {
      this._onIncrement(false);
    } else if (event.key === 'ArrowDown') {
      this._onDecrement(false);
    }
  }

  protected _onDecrement(autoIncrementOnLongPress = true) {
    this._clearAutoValueUpdateInterval();

    this._updateValue(this._currentValue() - 1);

    if (autoIncrementOnLongPress) {
      this._autoValueUpdateStartTimestamp = Date.now();
      this._autoValueUpdateIntervalId = window.setInterval(() => {
        if (Date.now() - this._autoValueUpdateStartTimestamp >= 1000) {
          this._updateValue(this._currentValue() - 10);
        }
      }, 500);
    }
  }

  protected _onIncrement(autoIncrementOnLongPress = true) {
    this._clearAutoValueUpdateInterval();

    this._updateValue(this._currentValue() + 1);

    if (!autoIncrementOnLongPress) {
      return;
    }

    this._autoValueUpdateStartTimestamp = Date.now();
    this._autoValueUpdateIntervalId = window.setInterval(() => {
      if (Date.now() - this._autoValueUpdateStartTimestamp >= 1000) {
        this._updateValue(this._currentValue() + 10);
      }
    }, 500);
  }

  @HostListener('window:mouseup')
  private _clearAutoValueUpdateInterval() {
    clearInterval(this._autoValueUpdateIntervalId);
    this._autoValueUpdateIntervalId = -1;
  }
}
