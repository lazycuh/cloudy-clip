import bezierEasingModule from 'bezier-easing';

import { interpolate } from '../../interpolate';

const easingFunction = bezierEasingModule(0.04, 0.54, 0.25, 1);

export function performScroll(calculator: (t: number) => number) {
  interpolate(1000, t => {
    document.body.scrollTop = calculator(easingFunction(t));
  });
}

export function scrollToTop() {
  const currentScrollTop = document.body.scrollTop;

  if (currentScrollTop > 0) {
    performScroll(t => currentScrollTop * (1 - t));
  }
}
