import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Host,
  inject,
  input,
  TemplateRef,
  viewChild,
  ViewEncapsulation
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatRipple } from '@angular/material/core';
import { DialogService } from '@lazycuh/web-ui-common/dialog';
import { FormComponent } from '@lazycuh/web-ui-common/form/form';
import { ShortTextFormFieldComponent } from '@lazycuh/web-ui-common/form/short-text-form-field';
import { Editor } from '@tiptap/core';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';

import { getTextForActiveMark, isValidHyperlink, TIPPY_OPTIONS } from '../../../helpers';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    style: 'position: absolute; display: none;'
  },
  imports: [ReactiveFormsModule, FormComponent, ShortTextFormFieldComponent, MatRipple],
  selector: 'lc-link-editor',
  styleUrl: './link-editor.component.scss',
  templateUrl: './link-editor.component.html'
})
export class LinkEditorComponent {
  readonly editor = input.required<Editor>();
  readonly selectedText = input.required<string>();

  protected readonly _linkEditorForm = new FormGroup({
    displayText: new FormControl<string>('', { nonNullable: true }),
    link: new FormControl<string>('', { nonNullable: true })
  });

  private readonly _dialogService = inject(DialogService);
  private readonly _linkEditorTemplate = viewChild.required(TemplateRef);

  constructor(@Host() host: ElementRef<HTMLElement>) {
    afterNextRender({
      write: () => {
        this.editor().registerPlugin(
          BubbleMenuPlugin({
            editor: this.editor(),
            element: host.nativeElement.querySelector<HTMLElement>(
              '.long-text-form-field__bubble-menu.link-action-bubble-menu'
            )!,
            pluginKey: 'link-action-bubble-menu',
            shouldShow: ({ editor }) => editor.isActive('link'),
            tippyOptions: TIPPY_OPTIONS
          })
        );
      }
    });
  }

  open() {
    const editor = this.editor();

    if (editor.isActive('link')) {
      const { href } = editor.getAttributes('link');

      this._linkEditorForm.controls.displayText.setValue(getTextForActiveMark(editor, 'link'));
      this._linkEditorForm.controls.link.setValue(href);
    }

    if (this.selectedText()) {
      this._linkEditorForm.controls.displayText.setValue(this.selectedText());
    }

    this._linkEditorForm.markAsDirty();
    this._linkEditorForm.markAllAsTouched();

    this._dialogService
      .setClassName('long-text-form-field__link-editor')
      .addButton({
        class: 'lc-button lc-accent',
        label: $localize`Close`,
        onClick: () => {
          this._closeLinkEditor();
        }
      })
      .addButton({
        class: 'lc-filled-button lc-primary',
        label: $localize`Save`,
        onClick: () => {
          this._onSaveLinkUpdate();
        }
      })
      .setContent(this._linkEditorTemplate())
      .open();
  }

  private _closeLinkEditor() {
    this._dialogService.close();
    this._linkEditorForm.reset();
    this.editor().chain().focus().run();
  }

  protected _onSaveLinkUpdate() {
    const urlFormControl = this._linkEditorForm.controls.link;
    let updatedUrl = urlFormControl.value.trim();

    if (!updatedUrl) {
      this._closeLinkEditor();

      return;
    }

    // not sure why this was reported as a test file
    // eslint-disable-next-line vitest/no-conditional-tests
    if (!/^https?:\/\//.test(updatedUrl)) {
      updatedUrl = `https://${updatedUrl}`;
    }

    if (!isValidHyperlink(updatedUrl)) {
      urlFormControl.setErrors({ link: $localize`Link is not valid` });

      return;
    }

    if (!updatedUrl) {
      this.editor().chain().focus().unsetLink().run();
    } else if (!this.editor().isActive('link')) {
      this._insertLinkAtCursor(updatedUrl, this._linkEditorForm.controls.displayText.value);
    } else if (!this.selectedText()) {
      this.editor()
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: updatedUrl })
        .deleteRange(this.editor().state.selection)
        .insertContent({ text: this._linkEditorForm.controls.displayText.value, type: 'text' })
        .run();
    } else {
      this.editor().chain().focus().deleteRange(this.editor().state.selection).run();

      this._insertLinkAtCursor(updatedUrl, this._linkEditorForm.controls.displayText.value);
    }

    this._closeLinkEditor();
  }

  private _insertLinkAtCursor(url: string, text: string) {
    const linkText = text || url;
    const attributes: Record<string, string> = { href: url, target: '_blank' };

    this.editor().commands.insertContent({
      marks: [{ attrs: attributes, type: 'link' }],
      text: linkText,
      type: 'text'
    });
  }

  protected _onOpenLinkInNewTab() {
    const { href } = this.editor().getAttributes('link');
    window.open(href, '_blank');
  }
}
