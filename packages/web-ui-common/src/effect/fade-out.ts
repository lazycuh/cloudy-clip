import { animate, style, transition, trigger } from '@angular/animations';

export type FadeInAnimationOptions = {
  duration: string;
  easingFunction?: string;
  leavingTransition?: string;
  name?: string;
};

export function fadeOut(options: FadeInAnimationOptions) {
  return trigger(options.name ?? 'fade-out', [
    transition(options.leavingTransition ?? ':leave', [
      style({ opacity: 1 }),
      animate(`${options.duration} ${options.easingFunction ?? 'ease'}`, style({ opacity: 0 }))
    ])
  ]);
}
