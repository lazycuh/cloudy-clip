import { PaymentReason } from './payment-reason';
import { PaymentStatus } from './payment-status';

export type Payment = {
  amountDue: string;
  currencyCode: string;
  discount: string;
  failureReason: string | null;
  paidAt: string;
  paymentId: string;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  paymentReason: PaymentReason;
  status: PaymentStatus;
  subtotal: string;
  tax: string;
};
