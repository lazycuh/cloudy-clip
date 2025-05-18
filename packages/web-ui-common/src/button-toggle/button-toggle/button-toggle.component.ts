import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  output,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { MatRipple } from '@angular/material/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.is-selected]': '_isSelected()',
    class: 'lc-button-toggle'
  },
  imports: [MatRipple],
  selector: 'lc-button-toggle',
  styleUrls: ['./button-toggle.component.scss'],
  templateUrl: './button-toggle.component.html'
})
export class ButtonToggleComponent {
  readonly selected = input(false);
  readonly activate = output();

  readonly _isSelected = linkedSignal(() => this.selected());
  readonly _radioGroupName = signal('');

  constructor() {
    afterNextRender({
      write: () => {
        if (this.selected()) {
          this.activate.emit();
        }
      }
    });
  }

  protected _onSelect() {
    if (!this._isSelected()) {
      this._isSelected.set(true);
      this.activate.emit();
    }
  }
}
