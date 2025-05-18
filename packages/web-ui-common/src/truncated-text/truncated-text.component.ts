import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  Host,
  input,
  signal,
  ViewEncapsulation
} from '@angular/core';

import { InfoTooltipComponent } from '../info-tooltip';
import { isBrowser } from '../utils/is-browser';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.text-too-long]': '_isTextTooLong()',
    class: 'truncated-text'
  },
  imports: [InfoTooltipComponent],
  selector: 'lc-truncated-text',
  styleUrl: './truncated-text.component.scss',
  templateUrl: './truncated-text.component.html'
})
export class TruncatedTextComponent {
  readonly content = input.required<string>();

  protected readonly _isTextTooLong = signal(false);

  constructor(@Host() hostElementRef: ElementRef<HTMLElement>) {
    effect(() => {
      /* istanbul ignore if -- @preserve */
      if (!isBrowser()) {
        return;
      }

      setTimeout(() => {
        const content = this.content();
        const hostElement = hostElementRef.nativeElement;
        const infoIconWidth = 45;
        const maxWidth = Math.abs(
          Math.trunc(hostElement.parentElement?.getBoundingClientRect().width ?? 0) - infoIconWidth
        );

        const textContentWidth = hostElement.children[1]!.getBoundingClientRect().width;
        const widthOfOneCharacter = textContentWidth / content.length;
        const truncatedTextContainer = hostElement.firstElementChild as HTMLElement;

        if (textContentWidth <= maxWidth) {
          truncatedTextContainer.textContent = content;
          this._isTextTooLong.set(false);

          return;
        }

        this._isTextTooLong.set(true);

        const overflowingCharacterCount = Math.ceil(
          (textContentWidth + infoIconWidth - maxWidth) / widthOfOneCharacter
        );
        const indexToStartTruncating = Math.ceil((content.length - overflowingCharacterCount) / 2);

        const truncatedText = `${content.substring(0, indexToStartTruncating).trim()} . . . ${content
          .substring(indexToStartTruncating + overflowingCharacterCount)
          .trim()}`;

        truncatedTextContainer.textContent = truncatedText;
      }, 16);
    });
  }
}
