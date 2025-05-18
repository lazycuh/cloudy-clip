import { animate, state, style, transition, trigger } from '@angular/animations';

export type FadeInOutAnimationOptions = {
  duration: string;
  easingFunction?: string;
  enteringTransition?: string;
  leavingTransition?: string;
  name?: string;
};

export function fadeInOut(options: FadeInOutAnimationOptions) {
  return trigger(options.name ?? 'fade-in-out', [
    state('true', style({ opacity: 1, visibility: 'visible' })),
    state('false', style({ opacity: 0, visibility: 'hidden' })),
    transition(options.enteringTransition ?? ':enter', [
      style({ opacity: 0, visibility: 'hidden' }),
      animate(`${options.duration} ${options.easingFunction ?? 'ease'}`, style({ opacity: 1, visibility: 'visible' }))
    ]),
    transition(options.leavingTransition ?? ':leave', [
      style({ opacity: 1, visibility: 'visible' }),
      animate(`${options.duration} ${options.easingFunction ?? 'ease'}`, style({ opacity: 0, visibility: 'hidden' }))
    ])
  ]);
}
