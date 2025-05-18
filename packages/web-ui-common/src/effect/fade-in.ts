import { animate, style, transition, trigger } from '@angular/animations';

export type FadeInAnimationOptions = {
  duration: string;
  easingFunction?: string;
  enteringTransition?: string;
  name?: string;
};

export function fadeIn(options: FadeInAnimationOptions) {
  return trigger(options.name ?? 'fade-in', [
    transition(options.enteringTransition ?? ':enter', [
      style({ opacity: 0 }),
      animate(`${options.duration} ${options.easingFunction ?? 'ease'}`, style({ opacity: 1 }))
    ])
  ]);
}
