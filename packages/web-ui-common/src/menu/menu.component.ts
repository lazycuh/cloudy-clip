import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
  ViewEncapsulation
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatRippleModule } from '@angular/material/core';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { DomSanitizer } from '@angular/platform-browser';

import { BackdropComponent } from '@lazycuh/web-ui-common/backdrop';
import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { PortalOutletComponent } from '@lazycuh/web-ui-common/portal-outlet';
import { ClickEventBubblingStopper } from '@lazycuh/web-ui-common/utils/click-event-bubbling-stopper';

import { MenuOption } from './menu-option';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'menu'
  },
  imports: [MatMenuModule, MatRippleModule, IconComponent, PortalOutletComponent, BackdropComponent],
  selector: 'lc-menu',
  styleUrls: ['./menu.component.scss'],
  templateUrl: './menu.component.html'
})
export class MenuComponent<T> extends ClickEventBubblingStopper {
  readonly options = input.required<Array<MenuOption<T>>>();
  readonly control = input.required<FormControl<T>>();

  readonly ariaLabel = input<string>();
  readonly selectedOptionIndex = input(-1);
  readonly disabled = input(false);
  readonly pinDefaultSelectedOption = input(false);
  readonly closeAfterSelection = input(true);

  protected readonly _isOpen = signal(false);
  protected readonly _selectedOption = linkedSignal(() => {
    const selectedOptionIndex = this.selectedOptionIndex();

    if (selectedOptionIndex === -1 || this.options().length === 0) {
      return new MenuOption($localize`Select one`, null as T);
    }

    return this.options()[selectedOptionIndex]!;
  });

  protected readonly _selectedOptionLabel = computed(() => {
    return this._domSanitizer.bypassSecurityTrustHtml(
      this._selectedOption().labelWhenSelected ?? this._selectedOption().label
    );
  });

  private readonly _menuTrigger = viewChild.required(MatMenuTrigger, { read: MatMenuTrigger });
  private readonly _domSanitizer = inject(DomSanitizer);

  protected _onSelectionChange(event: Event, option: MenuOption<T>) {
    event.stopPropagation();

    if (!this.pinDefaultSelectedOption()) {
      this._selectedOption.set(option);
    }

    if (this.closeAfterSelection()) {
      this._menuTrigger().closeMenu();
    }

    this.control().setValue(option.value);
  }

  protected _formatLabel(option: MenuOption<T>) {
    return this._domSanitizer.bypassSecurityTrustHtml(option.label);
  }

  @HostListener('window:click')
  protected _closeMenu() {
    if (this._isOpen()) {
      /* istanbul ignore next -- @preserve */
      this._isOpen.set(false);
    }
  }
}
