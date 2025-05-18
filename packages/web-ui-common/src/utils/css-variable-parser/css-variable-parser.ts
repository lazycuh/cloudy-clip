import { isBrowser } from '../is-browser';

export class CssVariableParser {
  static getAsNumber(variableName: string, defaultValue = 0) {
    return Number(CssVariableParser.getAsString(variableName, String(defaultValue)).replace('px', ''));
  }

  static getAsString(variableName: string, defaultValue = '') {
    if (!isBrowser()) {
      return defaultValue;
    }

    return getComputedStyle(document.documentElement).getPropertyValue(variableName);
  }
}
