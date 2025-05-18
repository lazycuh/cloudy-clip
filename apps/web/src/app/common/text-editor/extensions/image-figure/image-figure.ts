import { ApplicationRef, ComponentRef, createComponent } from '@angular/core';
import { mergeAttributes, Node } from '@tiptap/core';
import { AngularNodeViewRenderer } from 'ngx-tiptap';

import { FigureComponent } from './figure';
import { ImageUploaderComponent } from './image-uploader';

export interface ImageWithCaptionOptions {
  HTMLAttributes: {
    alt: string;
    height: string;
    src: string;
    width: string;
  };
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageWithCaption: {
      openImageUploader: (anchor: EventTarget) => ReturnType;
      setImage: (options: { alt?: string; height?: string; src: string; width?: string }) => ReturnType;
    };
  }
}

export const ImageFigure = {
  configure: (applicationRef: ApplicationRef) => {
    let imageUploaderRef: ComponentRef<ImageUploaderComponent> | undefined;

    return Node.create({
      addAttributes() {
        return {
          alt: { default: null },
          height: { default: 'auto' },
          src: { default: null },
          width: { default: '100%' }
        };
      },
      addCommands() {
        return {
          openImageUploader:
            (anchor: EventTarget) =>
            ({ editor }) => {
              imageUploaderRef?.instance.registerOnImageSourceChangeHandler(imageUrl => {
                editor.chain().focus().setImage({ src: imageUrl }).run();
              });

              imageUploaderRef?.instance.open(anchor as HTMLElement);

              return true;
            },
          setImage:
            ({ src, alt = '', width, height }) =>
            ({ commands }) => {
              return commands.insertContent({
                attrs: { alt, height, src, width },
                // content: caption ? [{ text: caption, type: 'text' }] : [],
                type: 'imageFigure'
              });
            }
        };
      },
      addNodeView() {
        return AngularNodeViewRenderer(FigureComponent, { injector: applicationRef.injector });
      },
      content: 'inline*',
      draggable: true,
      group: 'block',
      isolating: true,
      name: 'imageFigure',

      onCreate() {
        imageUploaderRef = createComponent(ImageUploaderComponent, {
          environmentInjector: applicationRef.injector
        });

        applicationRef.attachView(imageUploaderRef.hostView);
        document.body.appendChild(imageUploaderRef.location.nativeElement);
      },

      onDestroy() {
        document.body.removeChild(imageUploaderRef!.location.nativeElement);
        applicationRef.detachView(imageUploaderRef!.hostView);
        imageUploaderRef!.destroy();
      },

      parseHTML() {
        return [
          {
            tag: 'lc-figure'
          }
        ];
      },
      renderHTML({ HTMLAttributes }) {
        return ['lc-figure', mergeAttributes(HTMLAttributes), 0];
      },
      selectable: true
    });
  }
};
