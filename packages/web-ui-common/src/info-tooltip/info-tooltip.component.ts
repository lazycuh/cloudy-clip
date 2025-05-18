import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  TemplateRef,
  viewChild,
  ViewEncapsulation
} from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { TooltipService } from '@lazycuh/angular-tooltip';

import { IconComponent } from '../icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'info-tooltip'
  },
  imports: [IconComponent, MatRipple],
  selector: 'lc-info-tooltip',
  styleUrl: './info-tooltip.component.scss',
  templateUrl: './info-tooltip.component.html'
})
export class InfoTooltipComponent {
  private readonly _contentTemplateRef = viewChild.required('content', { read: TemplateRef });
  private readonly _tooltipService = inject(TooltipService);

  private _isTooltipVisible = false;

  protected _onToggleContentTooltip(event: MouseEvent) {
    event.stopPropagation();

    if (!this._isTooltipVisible) {
      this._tooltipService.show(event.target as HTMLButtonElement, {
        content: this._contentTemplateRef()
      });

      this._isTooltipVisible = true;
    } else {
      this._onHideContentTooltip();
    }
  }

  @HostListener('window:click')
  protected _onHideContentTooltip() {
    this._tooltipService.hideAll();
    this._isTooltipVisible = false;
  }
}
