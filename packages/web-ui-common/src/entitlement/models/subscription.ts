import { Plan } from './plan';

export type Subscription = {
  canceledAt: string | null;
  cancellationReason: CancellationReason | null;
  plan: Plan;
};

export type CancellationReason = 'REQUESTED_BY_USER' | 'PAYMENT_FAILED' | 'PAYMENT_DISPUTED';
