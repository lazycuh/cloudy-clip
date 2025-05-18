import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Host,
  inject,
  input,
  signal,
  ViewEncapsulation
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { MatFormField } from '@angular/material/form-field';
import { AnchoredFloatingBox, TriggerFloatingBoxForDirective } from '@lazycuh/angular-anchored-floating-box';
import { TooltipDirective } from '@lazycuh/angular-tooltip';
import { fadeIn } from '@lazycuh/web-ui-common/effect/fade-in';
import { fadeInOut } from '@lazycuh/web-ui-common/effect/fade-in-out';
import { IconComponent } from '@lazycuh/web-ui-common/icon';
import { InfoTooltipComponent } from '@lazycuh/web-ui-common/info-tooltip';
import { KeyboardShortcutComponent } from '@lazycuh/web-ui-common/keyboard-shortcut';
import { NumberInputComponent } from '@lazycuh/web-ui-common/number-input';
import { getSupportEmailLink } from '@lazycuh/web-ui-common/utils/get-support-email-link';
import { Editor, NodePos } from '@tiptap/core';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import Highlight from '@tiptap/extension-highlight';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { fromEvent, map, takeUntil } from 'rxjs';

import { EditableLink, FontSize } from './extensions';
import { AutoSaving } from './extensions/auto-saving';
import { ImageFigure } from './extensions/image-figure/image-figure';
import { TableController } from './extensions/table';
import { getNodePosAtCursor, hasTextSelection, TIPPY_OPTIONS } from './helpers';

@Component({
  animations: [
    fadeInOut({ duration: '250ms', name: 'table-editor' }),
    fadeIn({ duration: '250ms', name: 'auto-save-status' })
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.has-focus]': '_hasFocus()',
    class: 'text-editor'
  },
  imports: [
    ReactiveFormsModule,
    IconComponent,
    MatRipple,
    TiptapEditorDirective,
    TooltipDirective,
    TriggerFloatingBoxForDirective,
    NumberInputComponent,
    AnchoredFloatingBox,
    KeyboardShortcutComponent,
    DatePipe,
    InfoTooltipComponent
  ],
  selector: 'lc-text-editor',
  styleUrl: './text-editor.component.scss',
  templateUrl: './text-editor.component.html'
})
export class TextEditorComponent {
  readonly id = input.required<string>();
  readonly control = input.required<FormControl<string>>();

  readonly appearance = input<MatFormField['appearance']>('outline');
  readonly rows = input(10);

  protected readonly _isDomReady = signal(false);
  protected readonly _currentTextSizeInPx = signal(16);
  protected readonly _lastAutoSavedTimeStamp = signal<Date | null>(null);
  protected readonly _autoSaveFailureReason = signal('');
  protected readonly _lastEditorSavedHeight = signal('280px');

  protected _editor!: Editor;

  constructor(@Host() host: ElementRef<HTMLElement>) {
    const applicationRef = inject(ApplicationRef);
    const destroyRef = inject(DestroyRef);

    afterNextRender({
      write: () => {
        this._isDomReady.set(true);
        this._editor = new Editor({
          extensions: [
            FontSize.configure({ types: ['heading', 'paragraph'] }),
            EditableLink.configure(applicationRef),
            TableController.configure(applicationRef),
            StarterKit,
            TaskList,
            AutoSaving.configure({
              onFailure: error => {
                this._autoSaveFailureReason.set(error.message);
              },
              onSuccess: () => {
                this._autoSaveFailureReason.set('');
                this._lastAutoSavedTimeStamp.set(new Date());
              },
              schemaVersion: 1,
              storeName: this.id()
            }),
            TaskItem.configure({
              nested: true
            }),
            Highlight.configure({ multicolor: true }),
            TextAlign.configure({
              types: ['heading', 'paragraph', 'figcaption']
            }),
            ImageFigure.configure(applicationRef)
          ],
          injectCSS: true,
          onCreate: onCreateEvent => {
            onCreateEvent.editor.registerPlugin(
              BubbleMenuPlugin({
                editor: onCreateEvent.editor,
                element: host.nativeElement.querySelector<HTMLElement>('.quick-actions')!,
                pluginKey: 'quick-action-bubble-menu',
                shouldShow: ({ editor }) => hasTextSelection(editor) && !editor.isActive('link'),
                tippyOptions: TIPPY_OPTIONS
              })
            );

            onCreateEvent.editor.view.dom.style.height = localStorage.getItem('editorHeight') ?? '280px';
          }
        });

        destroyRef.onDestroy(() => {
          this._editor.destroy();
        });
      }
    });
  }

  protected _hasFocus() {
    return this._isDomReady() && this._editor.isFocused;
  }

  protected _onBeforeTextSizeInputOpened() {
    const fontSize = getNodePosAtCursor(this._editor).attributes.fontSize;

    if (fontSize) {
      this._currentTextSizeInPx.set(parseInt(fontSize, 10));
    }
  }

  protected _onTextSizeChange(newSize: number) {
    this._currentTextSizeInPx.set(newSize);
    this._editor.chain().setFontSize(`${newSize}px`).run();
  }

  protected _onResetFontSize() {
    this._currentTextSizeInPx.set(16);
    this._editor.chain().unsetFontSize().run();
  }

  protected _hasTextAlignment(textAlignment?: string) {
    if (textAlignment) {
      return this._editor.isActive({ textAlign: textAlignment });
    }

    return (
      this._editor.isActive({ textAlign: 'center' }) ||
      this._editor.isActive({ textAlign: 'justify' }) ||
      this._editor.isActive({ textAlign: 'right' })
    );
  }

  protected _onAlignText(textAlignmentOptionsFloatingBox: TriggerFloatingBoxForDirective, alignment: string) {
    this._editor.chain().focus().setTextAlign(alignment).run();
    textAlignmentOptionsFloatingBox.close();
  }

  protected _onToggleBlockquote() {
    if (!this._editor.isActive('blockquote')) {
      this._editor.chain().focus().selectParentNode().setItalic().setBlockquote().run();
    } else {
      this._editor.chain().focus().selectParentNode().unsetItalic().unsetBlockquote().run();
    }

    this._moveCursorToEndOfNode();
  }

  private _moveCursorToEndOfNode() {
    const state = this._editor.state;
    const currentNode = state.doc.nodeAt(state.selection.$from.pos);

    if (currentNode) {
      const endPosition = state.selection.$from.pos + currentNode.nodeSize;
      this._editor.commands.setTextSelection(endPosition);
    }
  }

  protected _onAddHardBreak() {
    const currentNode: NodePos = getNodePosAtCursor(this._editor);

    if (this._editor.isActive('table')) {
      const tbody = currentNode.closest('table')!;
      this._editor.commands.insertContentAt(tbody.range.to, {
        type: 'hardBreak'
      });
    } else {
      this._editor.commands.setTextSelection(this._editor.state.selection.to);
      this._editor.commands.insertContentAt(currentNode.pos, { type: 'hardBreak' });
    }

    this._editor.commands.focus();
  }

  protected _getContactUsLinkWhenAutoSaveFailed() {
    return getSupportEmailLink($localize`Auto-save failed`, `Reason: ${this._autoSaveFailureReason()}`);
  }

  protected _onBeginResizing(event: PointerEvent, editorContainer: HTMLElement) {
    event.preventDefault();

    const pointerUp = fromEvent(window, 'pointerup');
    const editorElement = editorContainer.firstElementChild as HTMLElement;
    const editorElementCurrentHeight = editorElement.clientHeight;
    const touchYCoordinate = event.clientY;
    const dragHandle = event.target as HTMLButtonElement;

    document.body.classList.add('is-dragging');
    dragHandle.classList.add('is-dragging');

    fromEvent<PointerEvent>(window, 'pointermove')
      .pipe(
        takeUntil(pointerUp),
        map(e => Math.max(280, editorElementCurrentHeight + (e.clientY - touchYCoordinate))),
        map(newHeight => `${newHeight}px`)
      )
      .subscribe({
        complete: () => {
          document.body.classList.remove('is-dragging');
          dragHandle.classList.remove('is-dragging');
          localStorage.setItem('editorHeight', editorElement.style.height);
        },
        next: newHeight => {
          editorElement.style.height = newHeight;
        }
      });
  }
}
