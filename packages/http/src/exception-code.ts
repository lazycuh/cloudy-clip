export const enum ExceptionCode {
  EMAIL_PASSWORD_LOGIN_NOT_ALLOWED = 'EmailPasswordLoginNotAllowedForOauth2UserException',
  FAILED_PAYMENT = 'FailedPaymentException',
  INCORRECT_EMAIL_OR_PASSWORD = 'IncorrectEmailOrPasswordException',
  NOT_FOUND = 'NotFoundException',
  OAUTH2_LOGIN_NOT_ALLOWED = 'Oauth2LoginNotAllowedException',
  PASSWORD_RESET_NOT_ALLOWED_FOR_OAUTH2_USER = 'PasswordResetNotAllowedForOauth2UserException',
  REQUIRED_STATES_ARE_MISSING = 'RequiredStatesAreMissingException',
  RESOURCE_EXISTS = 'ResourceExistsException',
  TOO_MANY_REQUESTS = 'TooManyRequestsException',
  UNKNOWN = 'UnknownException',
  USER_IS_BLOCKED = 'UserIsBlockedException',
  VALIDATION = 'ValidationException'
}
