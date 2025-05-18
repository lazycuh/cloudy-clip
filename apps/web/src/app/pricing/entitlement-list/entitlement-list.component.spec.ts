/* eslint-disable max-len */
import { describe, expect, it } from 'vitest';

import { FREE_MONTHLY_PLAN } from 'test/data';
import { deepCloneObject, renderComponent } from 'test/utils';

import { EntitlementListComponent } from './entitlement-list.component';

describe(EntitlementListComponent.name, () => {
  it('Renders correctly', async () => {
    const renderResult = await renderComponent(EntitlementListComponent, {
      inputs: {
        entitlements: deepCloneObject(FREE_MONTHLY_PLAN).entitlements
      }
    });

    const entitlementItems = renderResult.container.querySelectorAll('.entitlement-list__item');
    expect(entitlementItems).toHaveLength(4);

    expect(entitlementItems[0]).not.toHaveClass('is-disabled');
    expect(entitlementItems[0]).toHaveTextContent('Unlimited number of journal entries');
    expect(entitlementItems[0]!.firstElementChild!.firstElementChild!.firstElementChild).not.toHaveAttribute(
      'fill',
      'gray'
    );
    expect(entitlementItems[0]!.firstElementChild!.firstElementChild!.firstElementChild).toHaveAttribute(
      'd',
      'm382-354 339-339q12-12 28.5-12t28.5 12q12 12 12 28.5T778-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z'
    );

    expect(entitlementItems[1]).not.toHaveClass('is-disabled');
    expect(entitlementItems[1]).toHaveTextContent('Max 250 characters per journal entry');
    expect(entitlementItems[1]!.firstElementChild!.firstElementChild!.firstElementChild).not.toHaveAttribute(
      'fill',
      'gray'
    );
    expect(entitlementItems[1]!.firstElementChild!.firstElementChild!.firstElementChild).toHaveAttribute(
      'd',
      'm382-354 339-339q12-12 28.5-12t28.5 12q12 12 12 28.5T778-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z'
    );

    expect(entitlementItems[2]).not.toHaveClass('is-disabled');
    expect(entitlementItems[2]).toHaveTextContent('30 days data storage');
    expect(entitlementItems[2]!.firstElementChild!.firstElementChild!.firstElementChild).not.toHaveAttribute(
      'fill',
      'gray'
    );
    expect(entitlementItems[2]!.firstElementChild!.firstElementChild!.firstElementChild).toHaveAttribute(
      'd',
      'm382-354 339-339q12-12 28.5-12t28.5 12q12 12 12 28.5T778-636L410-268q-12 12-28 12t-28-12L182-440q-12-12-11.5-28.5T183-497q12-12 28.5-12t28.5 12l142 143Z'
    );

    expect(entitlementItems[3]).toHaveClass('is-disabled');
    expect(entitlementItems[3]).toHaveTextContent('Ability to embed images');
    expect(entitlementItems[3]!.firstElementChild!.firstElementChild!.firstElementChild).toHaveAttribute(
      'fill',
      'gray'
    );
    expect(entitlementItems[3]!.firstElementChild!.firstElementChild!.firstElementChild).toHaveAttribute(
      'd',
      'M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z'
    );
  });
});
