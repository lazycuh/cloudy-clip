import { CountryCode } from './countries';

export type BillingInfo = {
  readonly countryCode: CountryCode;
  readonly fullName: string;
  readonly postalCode: string;
};
