import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  DestroyRef,
  ElementRef,
  Host,
  inject,
  input,
  signal,
  ViewEncapsulation
} from '@angular/core';

import { generateRandomString } from '@lazycuh/web-ui-common/utils/generate-random-string';

import { ActiveToggleIndicatorComponent } from '../active-toggle-indicator';
import { ButtonToggleComponent } from '../button-toggle';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[attr.aria-label]': 'label()',
    '[attr.name]': '_radioGroupName',
    class: 'lc-button-toggle-group',
    role: 'radiogroup'
  },
  imports: [ActiveToggleIndicatorComponent],
  selector: 'lc-button-toggle-group',
  styleUrls: ['./button-toggle-group.component.scss'],
  templateUrl: './button-toggle-group.component.html'
})
export class ButtonToggleGroupComponent {
  /**
   * ARIA label for the radio group.
   */
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly label = input.required<string>({ alias: 'aria-label' });

  /**
   * Radio group name used for screen reader to group all the button toggles.
   * This is for implementing the ARIA radio group pattern.
   */
  protected readonly _radioGroupName = generateRandomString();
  protected readonly _buttonToggles = contentChildren(ButtonToggleComponent);
  protected readonly _selectedButtonToggleElement = signal<HTMLElement | null | undefined>(undefined);

  private _selectedButtonToggle?: ButtonToggleComponent;

  constructor(@Host() host: ElementRef<HTMLElement>) {
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      write: () => {
        this._selectedButtonToggle = this._buttonToggles()[0]!;
        this._selectedButtonToggle._isSelected.set(true);

        this._buttonToggles().forEach((buttonToggle, i) => {
          buttonToggle._radioGroupName.set(this._radioGroupName);

          const subscription = buttonToggle.activate.subscribe(() => {
            this._selectedButtonToggle!._isSelected.set(false);
            this._selectedButtonToggle = buttonToggle;
            buttonToggle._isSelected.set(true);
            this._selectedButtonToggleElement.set(
              host.nativeElement.querySelector<HTMLElement>(`.lc-button-toggle:nth-of-type(${i + 1})`)
            );
          });

          destroyRef.onDestroy(() => {
            subscription.unsubscribe();
          });
        });
      }
    });
  }
}
