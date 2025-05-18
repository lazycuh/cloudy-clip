/* eslint-disable max-len */
import { RenderResult } from '@testing-library/angular';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';

import { PrivacyPolicyComponent } from './privacy-policy.component';

describe(PrivacyPolicyComponent.name, () => {
  let renderResult: RenderResult<PrivacyPolicyComponent>;

  beforeEach(async () => {
    renderResult = await renderComponent(PrivacyPolicyComponent);
  });

  it('should have correct wordings', () => {
    expect(renderResult.getByText('Privacy Policy')).toBeInTheDocument();
    expect(
      renderResult.getByText(
        /is committed to protecting your privacy\. This Privacy Policy explains how we collect, use, and disclose your personal information when you use our application\./
      )
    ).toBeInTheDocument();
    expect(renderResult.getByText('Information we collect')).toBeInTheDocument();
    expect(renderResult.getByText('Personal information:')).toBeInTheDocument();
  });
});
