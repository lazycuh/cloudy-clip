import { ChangeDetectionStrategy, Component } from '@angular/core';
import { screen } from '@testing-library/angular';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { CurvedUnderlineComponent } from './curved-underline.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurvedUnderlineComponent],
  selector: 'lc-test-bed',
  template: '<lc-curved-underline>Hello World</lc-curved-underline>'
})
class TestBedComponent {}

describe(CurvedUnderlineComponent.name, () => {
  it('Render properly', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(screen.getByText('Hello World')).toBeInTheDocument();
    expect(document.querySelector('.curved-underline')).toEqual(renderResult.container.firstElementChild);
  });
});
