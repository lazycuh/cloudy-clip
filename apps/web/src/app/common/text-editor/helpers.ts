import { Editor } from '@tiptap/core';
import { BubbleMenuPluginProps } from '@tiptap/extension-bubble-menu';

export const TIPPY_OPTIONS: BubbleMenuPluginProps['tippyOptions'] = Object.freeze({
  animation: 'scale',
  duration: 150,
  hideOnClick: false,
  placement: 'top',
  trigger: 'manual'
});

export function getNodePosAtCursor(editor: Editor) {
  return editor.$pos(editor.state.selection.to);
}

export function hasTextSelection(editor: Editor) {
  return getSelectedText(editor).length > 0;
}

export function getSelectedText(editor: Editor) {
  const selection = editor.state.selection;

  return editor.$doc.content.textBetween(selection.from, selection.to).trim();
}

export function getTextForActiveMark(editor: Editor, markName: string) {
  editor.chain().extendMarkRange(markName).run();

  return editor.state.doc.nodeAt(editor.state.selection.$anchor.pos)?.text ?? '';
}

const linkRegex =
  /^(?:https?:)?\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;

export function isValidHyperlink(value: string) {
  return linkRegex.test(value.trim());
}
