import { RenderResult } from '@testing-library/angular';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderComponent } from 'test/utils';
import { trimToOneLine } from 'test/utils/trim-to-one-line';

import { TermsOfServiceComponent } from './terms-of-service.component';

describe(TermsOfServiceComponent.name, () => {
  let renderResult: RenderResult<TermsOfServiceComponent>;

  beforeEach(async () => {
    renderResult = await renderComponent(TermsOfServiceComponent);
  });

  it('should have correct wordings', () => {
    expect(renderResult.getByText('Terms of Service for Cloudy Clip Application')).toBeInTheDocument();
    expect(renderResult.getByText('1. Introduction to Cloudy Clip Terms of Service')).toBeInTheDocument();
    expect(
      renderResult.getByText(
        trimToOneLine(
          `This document establishes a legally binding agreement between Cloudy Clip (referred to as "we," "us," or
        "our") and the user ("you" or "user") governing the access to and use of the Cloudy Clip application and its
        services. The primary function of Cloudy Clip is to provide a platform exclusively for trade journaling. By
        using this application, you agree to adhere to the terms and conditions outlined herein. The agreement becomes
        effective immediately upon your initial use of the application . It is important to understand that these terms
        apply to all features and functionalities currently available within the Cloudy Clip application and any
        future updates or additions, unless explicitly stated otherwise.`
        )
      )
    ).toBeInTheDocument();
    expect(
      renderResult.getByText(
        trimToOneLine(
          `As the Cloudy Clip application evolves, it may become necessary to modify these Terms of Service. We
        expressly reserve the right to change these terms from time to time without providing direct notice to you. You
        acknowledge and agree that it is your responsibility to periodically review this document to familiarize
        yourself with any modifications. Your continued use of the Cloudy Clip application after any such
        modifications will constitute an acknowledgement of the updated Terms of Service and an agreement to be bound by
        them . This ensures that the terms remain relevant and applicable to the application's current state and any
        changes in legal or regulatory requirements.`
        )
      )
    ).toBeInTheDocument();
  });
});
