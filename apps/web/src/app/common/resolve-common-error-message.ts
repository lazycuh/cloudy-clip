const COMMON_ERROR_MESSAGE_TABLE: Record<string, string> = Object.freeze({
  'email is not valid': $localize`Email is not valid.`,

  // eslint-disable-next-line max-len
  'failed to verify jwt': $localize`Your session has ended. Please go to <a href="/login">login page</a> to log in again.`,

  // eslint-disable-next-line max-len
  'failed to verify turnstile token': $localize`We were not able to verify that you are human. Please try refreshing your browser.`,
  // eslint-disable-next-line max-len
  'jwt is missing or empty': $localize`Your session has ended. Please go to <a href="/login">login page</a> to log in again.`,
  'user is blocked': $localize`Your account has been blocked. Please contact site admin for assistance.`,
  'you have been blocked from making further requests': $localize`You have been blocked from making further requests.`
});

export function resolveCommonErrorMessage(englishErrorMessage: string, defaultMessage?: string) {
  return (
    COMMON_ERROR_MESSAGE_TABLE[englishErrorMessage] ??
    defaultMessage ??
    // eslint-disable-next-line max-len
    $localize`An unknown error has occurred while processing your request. Please try again later.<br/><br/>If you continue having issues, please contact us.`
  );
}
