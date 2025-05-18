import { ApplicationRef, ComponentRef, createComponent } from '@angular/core';
import { Extension } from '@tiptap/core';
import Link from '@tiptap/extension-link';

import { getSelectedText, isValidHyperlink } from '../../helpers';

import { LinkEditorComponent } from './link-editor';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    editableLink: {
      executeLinkCommand: () => ReturnType;
    };
  }
}

export const EditableLink = {
  configure: (applicationRef: ApplicationRef) => {
    let linkEditorRef: ComponentRef<LinkEditorComponent>;

    return Extension.create({
      addCommands() {
        return {
          executeLinkCommand:
            () =>
            ({ editor }) => {
              const selectedText = getSelectedText(editor);

              if (isValidHyperlink(selectedText)) {
                return editor.chain().focus().toggleLink({ href: selectedText }).run();
              }

              linkEditorRef.setInput('editor', editor);
              linkEditorRef.setInput('selectedText', selectedText);
              linkEditorRef.instance.open();

              return true;
            }
        };
      },
      addExtensions() {
        return [
          Link.configure({
            autolink: true,
            defaultProtocol: 'https',
            linkOnPaste: true,
            openOnClick: false,
            protocols: ['http', 'https'],
            shouldAutoLink: isValidHyperlink
          })
        ];
      },
      name: 'editableLink',
      onCreate() {
        linkEditorRef = createComponent(LinkEditorComponent, { environmentInjector: applicationRef.injector });
        linkEditorRef.setInput('editor', this.editor);
        linkEditorRef.setInput('selectedText', '');

        applicationRef.attachView(linkEditorRef.hostView);
        document.body.appendChild(linkEditorRef.location.nativeElement);
      },
      onDestroy() {
        document.body.removeChild(linkEditorRef.location.nativeElement);
        applicationRef.detachView(linkEditorRef.hostView);
        linkEditorRef.destroy();
      }
    });
  }
};
