import { EntitlementType } from '@lazycuh/web-ui-common/entitlement';
import { describe, expect, it } from 'vitest';

import { ESSENTIAL_MONTHLY_PLAN, FREE_MONTHLY_PLAN, LITE_MONTHLY_PLAN } from 'test/data';
import { deepCloneObject } from 'test/utils';

import { EntitlementFormatterPipe } from './entitlement-formatter.pipe';

describe(EntitlementFormatterPipe.name, () => {
  it('Formats entitlements correctly', () => {
    const pipe = new EntitlementFormatterPipe();
    expect(pipe.transform(FREE_MONTHLY_PLAN.entitlements[0]!)).toEqual('Max 250 characters per journal entry');
    expect(pipe.transform(FREE_MONTHLY_PLAN.entitlements[1]!)).toEqual('Ability to embed images');
    expect(pipe.transform(FREE_MONTHLY_PLAN.entitlements[2]!)).toEqual('30 days data storage');

    expect(pipe.transform(LITE_MONTHLY_PLAN.entitlements[0]!)).toEqual('No character count restriction');
    expect(pipe.transform(LITE_MONTHLY_PLAN.entitlements[1]!)).toEqual('Ability to embed images');
    expect(pipe.transform(LITE_MONTHLY_PLAN.entitlements[2]!)).toEqual('30 days data storage');

    expect(pipe.transform(ESSENTIAL_MONTHLY_PLAN.entitlements[0]!)).toEqual('No character count restriction');
    expect(pipe.transform(ESSENTIAL_MONTHLY_PLAN.entitlements[1]!)).toEqual('Ability to embed images');
    expect(pipe.transform(ESSENTIAL_MONTHLY_PLAN.entitlements[2]!)).toEqual('Lifetime data storage');
  });

  it('Throws error when an unrecognized entitlement type is provided', () => {
    const plan = deepCloneObject(FREE_MONTHLY_PLAN);

    plan.entitlements[0]!.type = 'UNKNOWN' as unknown as EntitlementType;

    const pipe = new EntitlementFormatterPipe();
    expect(() => pipe.transform(plan.entitlements[0]!)).toThrowError(
      // eslint-disable-next-line @stylistic/quotes
      new Error("unknown entitlement type 'UNKNOWN'")
    );
  });
});
