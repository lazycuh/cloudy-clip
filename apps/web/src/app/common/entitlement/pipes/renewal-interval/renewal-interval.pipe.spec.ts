/* eslint-disable @stylistic/quotes */
import { Plan } from '@lazycuh/web-ui-common/entitlement';
import { describe, expect, it } from 'vitest';

import { RenewalIntervalPipe } from './renewal-interval.pipe';

describe(RenewalIntervalPipe.name, () => {
  it('Returns correct value', () => {
    const pipe = new RenewalIntervalPipe();

    expect(pipe.transform('1m')).toEqual('month');
    expect(pipe.transform('1y')).toEqual('year');
  });

  it('Throws when an unrecognized value is provided', () => {
    const pipe = new RenewalIntervalPipe();

    expect(() => pipe.transform('1d' as Plan['renewedIn'])).toThrowError(`unrecognized renewal interval '1d'`);
  });
});
