const linkRegex =
  /^(?:https?:)?\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;

export function isValidHyperlink(value: string) {
  return linkRegex.test(value.trim());
}
