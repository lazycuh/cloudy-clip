import { animate, style, transition, trigger } from '@angular/animations';

export type ExpandAnimationOptions = {
  duration: string;
  easingFunction?: string;
  height: string;
  name?: string;
};

export function expand(options: ExpandAnimationOptions) {
  return trigger(options.name ?? 'expand', [
    transition(':enter', [
      style({ 'max-height': '0', opacity: 0, overflow: 'hidden' }),
      animate(
        `${options.duration} ${options.easingFunction ?? 'cubic-bezier(0.04, 0.54, 0.25, 1)'}`,
        style({ 'max-height': options.height, opacity: 1, overflow: 'hidden' })
      )
    ]),
    transition(':leave', [
      style({
        'max-height': options.height,
        opacity: 1,
        overflow: 'hidden'
      }),
      animate(
        `${options.duration} ${options.easingFunction ?? 'cubic-bezier(0.04, 0.54, 0.25, 1)'}`,
        style({ 'margin-bottom': '0', 'max-height': '0', opacity: 0 })
      )
    ])
  ]);
}
