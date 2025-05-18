import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Host,
  inject,
  input,
  ViewEncapsulation
} from '@angular/core';
import { executeUntil } from '@lazycuh/execute-until';

import { ClickEventBubblingStopper } from '@lazycuh/web-ui-common/utils/click-event-bubbling-stopper';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'portal-outlet'
  },
  selector: 'lc-portal-outlet',
  styleUrls: ['./portal-outlet.component.scss'],
  templateUrl: './portal-outlet.component.html'
})
export class PortalOutletComponent extends ClickEventBubblingStopper {
  readonly target = input<HTMLElement | null>(null);

  constructor(@Host() readonly host: ElementRef<HTMLElement>) {
    super();

    const destroyRef = inject(DestroyRef);

    let target!: HTMLElement;

    afterNextRender({
      write: async () => {
        target = this.target() ?? document.body;

        destroyRef.onDestroy(() => {
          try {
            target.removeChild(host.nativeElement);
          } catch {
            // Ignored
          }
        });

        await executeUntil(() => host.nativeElement.parentElement !== null);

        target.appendChild(this.host.nativeElement);
      }
    });
  }
}
