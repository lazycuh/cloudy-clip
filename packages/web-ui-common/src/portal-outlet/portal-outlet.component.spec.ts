import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { PortalOutletComponent } from './portal-outlet.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PortalOutletComponent],
  selector: 'lc-test-bed',
  template: `
    <lc-portal-outlet [target]="target()">
      <span>Hello World</span>
    </lc-portal-outlet>
  `
})
class TestBedComponent {
  target = input<HTMLElement | null>(null);
}

describe(PortalOutletComponent.name, () => {
  it('Render projected content as direct child of body by default', async () => {
    const renderResult = await renderComponent(TestBedComponent);

    expect(renderResult.queryByText('Hello World')).not.toBeInTheDocument();
    expect(document.body.lastElementChild).toHaveTextContent('Hello World');
  });

  it('Render projected content as direct child of provided target', async () => {
    const target = document.createElement('div');
    const renderResult = await renderComponent(TestBedComponent, { inputs: { target } });

    expect(renderResult.queryByText('Hello World')).not.toBeInTheDocument();
    expect(target).toHaveTextContent('Hello World');
  });
});
