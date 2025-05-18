import { PaymentMethod } from 'src/app/user-dashboard/payment-method-list/models';

export type CheckoutPreviewResponse = {
  amountDue: string;
  currencyCode: string;
  discount: string;
  refund: string;
  storedPaymentMethods: PaymentMethod[];
  subtotal: string;
  tax: string;
  taxPercentage: string;
};
