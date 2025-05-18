import { Extension } from '@tiptap/core';

export type FontSizeOptions = {
  defaultFontSize?: string;
  types: string[];
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * Set the font size
       */
      setFontSize: (fontSize: string) => ReturnType;
      /**
       * Unset the font size
       */
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create<FontSizeOptions>({
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ commands }) => {
          return this.options.types
            .map(type => commands.updateAttributes(type, { fontSize }))
            .every(response => response);
        },

      unsetFontSize:
        () =>
        ({ commands }) => {
          return this.options.types.map(type => commands.resetAttributes(type, this.name)).every(response => response);
        }
    };
  },

  addGlobalAttributes() {
    return [
      {
        attributes: {
          [this.name]: {
            default: this.options.defaultFontSize,
            parseHTML: element => {
              return element.style.fontSize || this.options.defaultFontSize;
            },
            renderHTML: attributes => {
              if (!attributes.fontSize || attributes.fontSize === this.options.defaultFontSize) {
                return {};
              }

              return { style: `font-size: ${attributes.fontSize}` };
            }
          }
        },
        types: this.options.types
      }
    ];
  },

  // addKeyboardShortcuts() {
  //   return {
  //     'Mod-Shift-e': () => this.editor.commands.setTextAlign('center'),
  //     'Mod-Shift-j': () => this.editor.commands.setTextAlign('justify'),
  //     'Mod-Shift-l': () => this.editor.commands.setTextAlign('left'),
  //     'Mod-Shift-r': () => this.editor.commands.setTextAlign('right')
  //   };
  // },

  addOptions() {
    return {
      defaultFontSize: '16px',
      types: []
    };
  },

  name: 'fontSize'
});
