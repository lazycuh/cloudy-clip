/* eslint-disable max-len */
/* eslint-disable camelcase */
export const paymentErrorMessages: Record<string, string> = Object.freeze({
  card_decline_rate_limit_exceeded: $localize`Your card was declined. Please contact your bank for details.`,
  card_declined: $localize`Your card was declined. Please contact your bank for details.`,
  'card_declined.card_velocity_exceeded': $localize`You have exceeded the balance, credit limit, or transaction amount limit available on your card. Please contact your bank to for details.`,
  'card_declined.generic_decline': $localize`Your card was declined. Please contact your bank for details.`,
  'card_declined.insufficient_funds': $localize`Your card has insufficient funds to complete the order. Please use a different card.`,
  'card_declined.invalid_amount': $localize`The payment amount is invalid, or exceeds the amount that's allowed on your card. Please contact your bank for details.`,
  'card_declined.issuer_not_available': $localize`We were not able to contact your bank for the payment. Please try again later or contact your bank for details.`,
  'card_declined.reenter_transaction': $localize`We've encountered an unknown issue while processing your payment. Please try again later or contact us if the issue persists.`,
  'card_declined.try_again_later': $localize`Your card was declined. Please try again later or contact your bank for details if the issue persists.`,
  'card_declined.withdrawal_count_limit_exceeded': $localize`You have exceeded the balance, credit limit, or transaction amount limit available on your card. Please contact your bank for details.`,
  expired_card: $localize`Your card has expired. Please use a valid card.`,
  incorrect_cvc: $localize`The provided CVC was not correct. Please try again with the correct CVC.`,
  incorrect_number: $localize`Your card number is not correct. Please try again with the correct card number.`,
  incorrect_zip: $localize`The entered billing zip code was not correct. Please try again with the correct zip code associated with your card.`,
  invalid_cvc: $localize`The provided CVC was not correct. Please try again with the correct CVC.`,
  invalid_expiry_month: $localize`The provided expiration month is invalid. Please try again with the correct expiration month for your card.`,
  invalid_expiry_year: $localize`The provided expiration year is invalid. Please try again with the correct expiration year for your card.`,
  invalid_number: $localize`Your card number is not correct. Please try again with the correct card number.`,
  processing_error: $localize`We've encountered an unknown issue while processing your payment. Please try again later or contact us if the issue persists.`
});
