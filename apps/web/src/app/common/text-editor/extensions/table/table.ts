import { ApplicationRef, ComponentRef, createComponent } from '@angular/core';
import { Extension } from '@tiptap/core';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';

import { TableControllerComponent } from './table-controller';

export const TableController = {
  configure: (applicationRef: ApplicationRef) => {
    let tableControllerRef: ComponentRef<TableControllerComponent> | undefined;

    return Extension.create({
      addExtensions() {
        return [
          Table.configure({
            resizable: true
          }),
          TableRow,
          TableHeader,
          TableCell.configure({
            HTMLAttributes: {
              width: '80px'
            }
          })
        ];
      },
      name: 'tableController',
      onCreate() {
        tableControllerRef = createComponent(TableControllerComponent, {
          environmentInjector: applicationRef.injector
        });
        tableControllerRef.setInput('editor', this.editor);

        applicationRef.attachView(tableControllerRef.hostView);
        document.body.appendChild(tableControllerRef.location.nativeElement);
      },
      onDestroy() {
        document.body.removeChild(tableControllerRef!.location.nativeElement);
        applicationRef.detachView(tableControllerRef!.hostView);
        tableControllerRef!.destroy();
      },
      onSelectionUpdate() {
        tableControllerRef?.instance.toggle(this.editor.isActive('table'));
      }
    });
  }
};
