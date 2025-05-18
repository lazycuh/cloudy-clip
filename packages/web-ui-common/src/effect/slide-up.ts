import { animate, style, transition, trigger } from '@angular/animations';

export type SlideUpAnimationOptions = {
  duration: string;
  easingFunction?: string;
  enteringTransition?: string;
  from: string;
  leavingTransition?: string;
  name?: string;
  to: string;
};

export function slideUp(options: SlideUpAnimationOptions) {
  return trigger(options.name ?? 'slide-up', [
    transition(options.enteringTransition ?? ':enter', [
      style({ opacity: 0, transform: `translateY(${options.from})` }),
      animate(
        `${options.duration} ${options.easingFunction ?? 'cubic-bezier(0.04, 0.54, 0.25, 1)'}`,
        style({ opacity: 1, transform: `translateY(${options.to})` })
      )
    ]),
    transition(options.leavingTransition ?? ':leave', [
      animate(
        `350ms ${options.easingFunction ?? 'cubic-bezier(0.04, 0.54, 0.25, 1)'}`,
        style({ opacity: 0, transform: `translateY(${options.from})` })
      )
    ])
  ]);
}
