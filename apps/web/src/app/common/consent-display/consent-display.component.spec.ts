import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { ConsentDisplayComponent } from './consent-display.component';

describe(ConsentDisplayComponent.name, () => {
  it('Renders correctly', async () => {
    @Component({
      changeDetection: ChangeDetectionStrategy.OnPush,
      imports: [ConsentDisplayComponent],
      selector: 'lc-test-bed',
      template: `
        <lc-consent-display>
          By loggin in, you agree to

          <a href="/hello">Hello World</a>
          <a href="/hi">Hi</a>
        </lc-consent-display>
      `
    })
    class TestBedComponent {}

    const renderResult = await renderComponent(TestBedComponent);

    expect(renderResult.getByText('By loggin in, you agree to')).toBeInTheDocument();
    expect(renderResult.getByText('Terms of Service')).toHaveAttribute('href', '/policies/terms-of-service');
    expect(renderResult.getByText('Privacy Policy')).toHaveAttribute('href', '/policies/privacy-policy');
    expect(renderResult.getByText('Hello World')).toHaveAttribute('href', '/hello');
    expect(renderResult.getByText('Hi')).toHaveAttribute('href', '/hi');

    const anchors = renderResult.container.querySelectorAll('a');
    expect(anchors).toHaveLength(4);
    expect(anchors[0]).toHaveTextContent('Terms of Service');
    expect(anchors[1]).toHaveTextContent('Privacy Policy');
    expect(anchors[2]).toHaveTextContent('Hello World');
    expect(anchors[3]).toHaveTextContent('Hi');
  });
});
