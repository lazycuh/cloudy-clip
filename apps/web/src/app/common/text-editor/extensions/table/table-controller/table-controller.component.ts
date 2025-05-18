import { ChangeDetectionStrategy, Component, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { AnchoredFloatingBox, TriggerFloatingBoxForDirective } from '@lazycuh/angular-anchored-floating-box';
import { NotificationService } from '@lazycuh/angular-notification';
import { TooltipDirective } from '@lazycuh/angular-tooltip';
import { fadeInOut } from '@lazycuh/web-ui-common/effect/fade-in-out';
import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { Editor, NodePos } from '@tiptap/core';

import { getNodePosAtCursor } from '../../../helpers';

@Component({
  animations: [
    fadeInOut({ duration: '250ms', enteringTransition: 'false => true', leavingTransition: 'true => false' })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[@fade-in-out]': '_isOpened()',
    class: 'table-controller'
  },
  imports: [
    ReactiveFormsModule,
    MatRipple,
    AnchoredFloatingBox,
    TriggerFloatingBoxForDirective,
    IconComponent,
    TooltipDirective
  ],
  selector: 'lc-table-controller',
  styleUrl: './table-controller.component.scss',
  templateUrl: './table-controller.component.html'
})
export class TableControllerComponent {
  readonly editor = input.required<Editor>();

  protected readonly _isOpened = signal(false);

  private readonly _notificationService = inject(NotificationService);

  toggle(isOpened: boolean) {
    this._isOpened.set(isOpened);
  }

  protected _onDuplicateRow() {
    const editor = this.editor();
    const currentNode: NodePos = getNodePosAtCursor(editor);
    const tableRowNodePoses = editor.$nodes('tableRow') ?? [];

    for (const tableRowNodePos of tableRowNodePoses) {
      // Current node is not within this table row's range
      if (currentNode.pos < tableRowNodePos.range.from || currentNode.pos > tableRowNodePos.range.to) {
        continue;
      }

      if (tableRowNodePos.children[0]?.node.type.name === 'tableHeader') {
        this._notificationService.open({
          content: $localize`Duplicating header row is not allowed.`
        });

        break;
      }

      editor.commands.insertContentAt(
        tableRowNodePos.range.from - 1,
        tableRowNodePos.node.copy(tableRowNodePos.node.content)
      );

      break;
    }
  }
}
