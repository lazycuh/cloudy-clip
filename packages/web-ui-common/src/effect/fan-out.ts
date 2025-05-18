import { animate, style, transition, trigger } from '@angular/animations';

export type FanOutAnimationOptions = {
  distanceInPx: number;
  duration: string;
  easingFunction?: string;
  name?: string;
};

export function fanOut(options: FanOutAnimationOptions) {
  return trigger(options.name ?? 'fan-out', [
    transition(':enter', [
      style({
        'border-color': '#151515',
        'border-radius': '100%',
        'border-style': 'solid',
        'border-width': `${options.distanceInPx}px`,
        height: 0,
        left: '50%',
        position: 'absolute',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        visibility: 'visible',
        width: 0
      }),
      animate(
        `${options.duration} 250ms ${options.easingFunction ?? 'cubic-bezier(0.04, 0.54, 0.25, 1)'}`,
        style({ 'border-width': 0, height: '110%', width: '125%' })
      )
    ])
  ]);
}
