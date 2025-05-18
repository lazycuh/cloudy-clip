/* eslint-disable @stylistic/quotes */
import { describe, expect, it } from 'vitest';

import { ESSENTIAL_MONTHLY_PLAN, ESSENTIAL_YEARLY_PLAN } from 'test/data';
import { deepCloneObject } from 'test/utils';

import { SubscriptionLabelPipe } from './subscription-label.pipe';

describe(SubscriptionLabelPipe.name, () => {
  it('Returns correct value', () => {
    const pipe = new SubscriptionLabelPipe();
    expect(pipe.transform(ESSENTIAL_MONTHLY_PLAN)).toEqual('Essential (Monthly)');
    expect(pipe.transform(ESSENTIAL_YEARLY_PLAN)).toEqual('Essential (Yearly)');
  });

  it('Throws when an unrecognized value is provided', () => {
    const pipe = new SubscriptionLabelPipe();

    const plan = deepCloneObject(ESSENTIAL_MONTHLY_PLAN);
    Object.assign(plan, { renewedIn: '1d' });

    expect(() => pipe.transform(plan)).toThrowError(`unrecognized renewal interval '1d'`);
  });
});
