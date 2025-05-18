import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { delayBy } from '../utils/delay-by';

import { ProgressCompleteIndicatorComponent } from './progress-complete-indicator.component';

describe(ProgressCompleteIndicatorComponent.name, () => {
  it('Render correctly for success state', async () => {
    const renderResult = await renderComponent(ProgressCompleteIndicatorComponent, {
      inputs: {
        animated: true,
        success: true
      }
    });

    const ring = renderResult.container.querySelector('.progress-complete-indicator__ring');

    expect(ring).toBeInTheDocument();
    expect(ring).toHaveAttribute('cx', '40');
    expect(ring).toHaveAttribute('cy', '40');
    expect(ring).toHaveAttribute('r', '40');
    expect(ring).toHaveAttribute('transform-origin', '40 40');

    await delayBy(16);

    const checkmark = renderResult.container.querySelector('.progress-complete-indicator__check-mark');
    expect(checkmark).toBeInTheDocument();
    expect(checkmark).toHaveAttribute('transform', 'translate(5, 5)');
    expect(checkmark).toHaveAttribute('d', 'M16.666666666666668,40 L33.333333333333336,50 L55,20');
  });

  it('Render correctly for failure state', async () => {
    const renderResult = await renderComponent(ProgressCompleteIndicatorComponent, {
      inputs: {
        animated: true,
        success: false
      }
    });

    const ring = renderResult.container.querySelector('.progress-complete-indicator__ring');

    expect(ring).toBeInTheDocument();
    expect(ring).toHaveAttribute('cx', '40');
    expect(ring).toHaveAttribute('cy', '40');
    expect(ring).toHaveAttribute('r', '40');
    expect(ring).toHaveAttribute('transform-origin', '40 40');

    await delayBy(16);

    const foreignObject = renderResult.container.querySelector('foreignObject');
    expect(foreignObject).toBeInTheDocument();
    expect(foreignObject).toHaveAttribute('height', '100');
    expect(foreignObject).toHaveAttribute('width', '100');

    expect(foreignObject?.querySelector('.first-segment')).toBeInTheDocument();
    expect(foreignObject?.querySelector('.second-segment')).toBeInTheDocument();
  });
});
