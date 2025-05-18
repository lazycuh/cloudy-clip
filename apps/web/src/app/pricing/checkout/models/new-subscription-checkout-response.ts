export type NewSubscriptionCheckoutResponse = {
  amountDue: string;
  clientSecret: string;
  discount: string;
  tax: string;
  taxPercentage: string;
};
