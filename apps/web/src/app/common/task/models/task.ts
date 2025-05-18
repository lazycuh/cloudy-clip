export type Task = {
  comment: string | null;
  status: 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';
  type: 'NEW_SUBSCRIPTION_PAYMENT' | 'SUBSCRIPTION_UPDATE_PAYMENT' | 'REACTIVATION_PAYMENT';
  updatedAt: string;
};
