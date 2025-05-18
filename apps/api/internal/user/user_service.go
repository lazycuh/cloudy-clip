package user

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/maypok86/otter"
	"github.com/pkg/errors"
	"github.com/cloudy-clip/api/internal/common/database"
	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/email"
	"github.com/cloudy-clip/api/internal/common/environment"
	"github.com/cloudy-clip/api/internal/common/exception"
	"github.com/cloudy-clip/api/internal/common/jwt"
	_logger "github.com/cloudy-clip/api/internal/common/logger"
	"github.com/cloudy-clip/api/internal/common/ulid"
	"github.com/cloudy-clip/api/internal/common/user"
	"github.com/cloudy-clip/api/internal/subscription"
	"github.com/cloudy-clip/api/internal/user/dto"
	userException "github.com/cloudy-clip/api/internal/user/exception"
	"github.com/cloudy-clip/api/internal/user/model"
	"golang.org/x/crypto/argon2"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/facebook"
	"golang.org/x/oauth2/google"
)

const (
	VerificationGracePeriodInDays byte = 7
	MaxLoginAttemptsAllowed       byte = 5
	DiscordAuthUrl                     = "https://discord.com/oauth2/authorize"
	DiscordTokenUrl                    = "https://discord.com/api/oauth2/token"
)

var (
	userServiceLogger *_logger.Logger
	loginAttemptCache otter.Cache[string, byte]
)

type UserService struct {
}

func NewUserService() *UserService {
	userServiceLogger = _logger.NewLogger("UserService", slog.Level(environment.Config.ApplicationLogLevel))

	cache, err := otter.MustBuilder[string, byte](1000).WithTTL(time.Hour).Build()
	if err != nil {
		userServiceLogger.ErrorAttrs(context.Background(), err, "failed to create logging attempt cache")
		panic(err)
	}

	loginAttemptCache = cache

	return &UserService{}
}

func (userService *UserService) createUser(
	ctx context.Context,
	payload *dto.CreateUserRequestPayload,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, exception.Exception) {
	authenticatedUser, err := createUser(ctx, payload, userIp, userAgent)
	if err == nil {
		return authenticatedUser, nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to create user",
		slog.String("userEmail", payload.Email),
		slog.String("userName", payload.DisplayName),
	)

	return nil, exception.GetAsApplicationException(err, "failed to create user")
}

func createUser(
	ctx context.Context,
	payload *dto.CreateUserRequestPayload,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	userId, err := ulid.Generate()
	if err != nil {
		return nil, err
	}

	salt, err := generateSalt()
	if err != nil {
		return nil, err
	}

	userModel := payload.ToUserModel()
	userModel.UserID = userId

	userModel.Password = hashAndStringifyPassword(payload.Password, salt)
	userModel.Salt = hex.EncodeToString(salt)

	var authenticatedUser *dto.AuthenticatedUser

	err = database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		err = userRepository.createUser(ctx, transaction, userModel)
		if err != nil {
			if database.IsDuplicateRecordError(err) {
				return exception.NewResourceExistsException("user already exists")
			}

			return err
		}

		err = sendAccountVerificationEmail(ctx, transaction, userId, payload.Email, payload.DisplayName)
		if err != nil {
			return err
		}

		authenticatedUser, err = establishAuthenticatedUserSession(ctx, userModel, userIp, userAgent)
		if err != nil {
			return err
		}

		return nil
	})
	if err == nil {
		return authenticatedUser, nil
	}

	if database.IsDuplicateRecordError(err) {
		return nil, errors.WithStack(exception.NewResourceExistsException("user already exists"))
	}

	return nil, err
}

func generateSalt() ([]byte, error) {
	salt := make([]byte, 32)
	_, err := rand.Read(salt)
	if err != nil {
		return nil, errors.WithStack(err)
	}

	return salt, nil
}

func hashAndStringifyPassword(password string, salt []byte) string {
	return hex.EncodeToString(hashPassword(password, salt))
}

func hashPassword(password string, salt []byte) []byte {
	// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#password-hashing-algorithms
	const (
		t         = 5
		m         = 7168
		p         = 1
		keyLength = 32
	)

	return argon2.IDKey([]byte(password), salt, t, m, p, keyLength)
}

func sendAccountVerificationEmail(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
	userEmail string,
	userDisplayName string,
) error {
	verificationCodeId, err := userRepository.createVerificationCode(
		ctx,
		transaction,
		userId,
		model.VerificationTypeAccountVerification,
	)
	if err != nil {
		return err
	}

	emailMessageBuilder := email.
		NewEmailBuilder().
		WithSubject("Account verification").
		WithDestinationEmail(userEmail).
		WithEmailFile("account-verification.html").
		SetTemplateVariable("UserDisplayName", userDisplayName).
		SetTemplateVariable("EmailVerificationPath", "/account/registration/verification?code="+verificationCodeId)

	messageId, err := email.SendGenericAccountAlertEmail(emailMessageBuilder)
	if err == nil {
		userServiceLogger.InfoAttrs(
			ctx,
			"sent account verification email",
			slog.String("userEmail", userEmail),
			slog.String("verificationCodeId", verificationCodeId),
			slog.String("messageId", messageId),
		)

		return nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send account verification email",
		slog.String("userEmail", userEmail),
		slog.String("verificationCodeId", verificationCodeId),
		slog.String("messageId", messageId),
	)

	return err
}

func establishAuthenticatedUserSession(
	ctx context.Context,
	user *_jetModel.User,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	userClaims := jwt.UserClaims{
		UserId:         user.UserID,
		Email:          user.Email,
		DisplayName:    user.DisplayName,
		Status:         user.Status.String(),
		LastLoggedInAt: user.LastLoggedInAt,
	}
	accessToken, err := jwt.Sign(&userClaims)
	if err != nil {
		return nil, err
	}

	if user.Status == model.UserStatusInactive {
		user.Status = model.UserStatusActive
		user.StatusReason = model.UserStatusReasonNone
	}

	user.LastLoggedInAt = time.Now()

	err = userRepository.updateUser(ctx, nil, user)
	if err != nil {
		return nil, err
	}

	userSession, err := createUserSession(user, userIp, userAgent)
	if err == nil {
		return dto.NewAuthenticatedUser(user, accessToken, userClaims.ExpiresAt.Time, userSession), nil
	}

	return nil, err
}

func createUserSession(user *_jetModel.User, userIp string, userAgent string) (*dto.UserSession, error) {
	aesGcm, nonce, err := createAesGcmCipher(true)
	if err != nil {
		return nil, err
	}

	userSession := dto.UserSession{
		UserId: user.UserID,
		Email:  user.Email,
		ExpiresAt: time.Now().Add(
			time.Duration(environment.Config.UserSessionLifeTimeSeconds) * time.Second,
		),
		Ip:        userIp,
		UserAgent: userAgent,
	}

	payloadToEncrypt, err := json.Marshal(userSession)
	if err == nil {
		userSession.Id = fmt.Sprintf(
			"%s%s",
			hex.EncodeToString(nonce),
			hex.EncodeToString(aesGcm.Seal(nil, nonce, payloadToEncrypt, nil)),
		)

		return &userSession, nil
	}

	return nil, errors.WithStack(err)
}

func createAesGcmCipher(withCreatingNonce bool) (cipher.AEAD, []byte, error) {
	signingSecret, err := hex.DecodeString(environment.Config.SigningSecret)
	if err != nil {
		return nil, nil, errors.WithStack(err)
	}

	block, err := aes.NewCipher(signingSecret)
	if err != nil {
		return nil, nil, errors.WithStack(err)
	}

	aesGcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, errors.WithStack(err)
	}

	if !withCreatingNonce {
		return aesGcm, nil, nil
	}

	nonce := make([]byte, aesGcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, errors.WithStack(err)
	}

	return aesGcm, nonce, nil
}

func (userService *UserService) patchUser(
	ctx context.Context,
	patchUserPayload *dto.PatchUserRequestPayload,
) exception.Exception {
	err := database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		userId := jwt.GetUserIdClaim(ctx)
		userToUpdate, err := user.FindUserById(ctx, transaction, userId)
		if err != nil {
			return err
		}

		err = checkPassword(&userToUpdate, patchUserPayload.CurrentPassword)
		if err == nil {
			return patchUser(ctx, transaction, userId, patchUserPayload)
		}

		return err
	})

	if patchUserPayload.NewPassword != "" {
		patchUserPayload.NewPassword = "..."
	}

	patchUserPayload.CurrentPassword = "..."

	if err == nil {
		userServiceLogger.InfoAttrs(
			ctx,
			"user was updated",
			slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
			slog.Any("patchUserPayload", patchUserPayload),
		)

		return nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to update user",
		slog.String("userEmail", jwt.GetUserEmailClaim(ctx)),
		slog.Any("patchUserPayload", patchUserPayload),
	)

	if errors.Is(err, userException.ErrWrongPassword) {
		return exception.NewValidationException("current password was not correct")
	}

	return exception.GetAsApplicationException(err, "failed to update user")
}

func checkPassword(user *_jetModel.User, passwordToCheck string) error {
	storedPassword, err := hex.DecodeString(user.Password)
	if err != nil {
		return errors.WithStack(err)
	}

	storedSalt, err := hex.DecodeString(user.Salt)
	if err != nil {
		return errors.WithStack(err)
	}

	hashedProvidedCurrentPassword := hashPassword(passwordToCheck, storedSalt)

	if subtle.ConstantTimeCompare(storedPassword, hashedProvidedCurrentPassword) != 1 {
		return userException.ErrWrongPassword
	}

	return nil
}

func patchUser(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
	patchUserPayload *dto.PatchUserRequestPayload,
) error {
	foundUser, err := user.FindUserById(ctx, transaction, userId)
	if err != nil {
		if database.IsEmptyResultError(err) {
			return exception.NewNotFoundException("no user was found")
		}

		return err
	}

	oldEmail := foundUser.Email
	hasUpdates := false

	emailBuilder := email.NewEmailBuilder().
		WithSubject("Your account was updated").
		WithDestinationEmail(oldEmail).
		WithEmailFile("account-info-change-warning.html").
		SetTemplateVariable("OldUserDisplayName", foundUser.DisplayName).
		SetTemplateVariable("OldUserEmail", foundUser.Email)

	if patchUserPayload.DisplayName != "" {
		emailBuilder = emailBuilder.SetTemplateVariable("NewUserDisplayName", patchUserPayload.DisplayName)
		foundUser.DisplayName = patchUserPayload.DisplayName
		hasUpdates = true
	}

	if patchUserPayload.Email != "" {
		emailBuilder = emailBuilder.SetTemplateVariable("NewUserEmail", patchUserPayload.Email)
		foundUser.Email = patchUserPayload.Email
		hasUpdates = true
	}

	if patchUserPayload.NewPassword != "" {
		saltByteArray, err := hex.DecodeString(foundUser.Salt)
		if err != nil {
			return errors.WithStack(err)
		}

		foundUser.Password = hashAndStringifyPassword(patchUserPayload.NewPassword, saltByteArray)
		hasUpdates = true
		emailBuilder = emailBuilder.SetTemplateVariable("HasPasswordChange", "true")
	}

	if !hasUpdates {
		userServiceLogger.WarnAttrs(
			ctx,
			"no changes were provided, no update will be performed",
			slog.String("userEmail", foundUser.Email),
		)

		return nil
	}

	err = userRepository.updateUser(ctx, transaction, &foundUser)
	if err != nil {
		return err
	}

	err = sendAccountInfoChangeEmail(ctx, emailBuilder)
	if err != nil {
		return err
	}

	if patchUserPayload.Email != "" {
		emailBuilder = emailBuilder.
			WithSubject("Account update confirmation").
			WithEmailFile("account-info-change-confirmation.html").
			WithDestinationEmail(patchUserPayload.Email).
			SetTemplateVariable("UserDisplayName", foundUser.DisplayName).
			SetTemplateVariable("UserEmail", foundUser.Email)

		err = sendAccountInfoChangeEmail(ctx, emailBuilder)
		if err != nil {
			return err
		}
	}

	return nil
}

func sendAccountInfoChangeEmail(ctx context.Context, emailBuilder *email.EmailBuilder) error {
	messageId, err := email.SendSecurityAlertEmail(emailBuilder)
	if err == nil {
		userServiceLogger.InfoAttrs(ctx, "sent account info change email", slog.String("messageId", messageId))

		return nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send account info change email",
		slog.String("messageId", messageId),
	)

	return err
}

func (userService *UserService) requestAnotherAccountVerificationEmail(ctx context.Context) exception.Exception {
	email := jwt.GetUserEmailClaim(ctx)

	err := database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		userId := jwt.GetUserIdClaim(ctx)

		verificationCodeQueryResult, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
			ctx,
			transaction,
			userId,
			model.VerificationTypeAccountVerification,
		)
		if err != nil && !database.IsEmptyResultError(err) {
			return err
		}

		if err == nil {
			if !verificationCodeQueryResult.IsExpired() {
				userServiceLogger.InfoAttrs(
					ctx,
					"account verification email was just recently sent, not sending another one",
					slog.String("userEmail", email),
					slog.Duration("timeSince", time.Since(verificationCodeQueryResult.CreatedAt)),
				)

				return nil
			}

			err = userRepository.deleteVerificationCodeEntry(
				ctx,
				transaction,
				verificationCodeQueryResult.VerificationCodeId,
			)
			if err != nil {
				return err
			}
		}

		return sendAccountVerificationEmail(
			ctx,
			transaction,
			userId,
			email,
			verificationCodeQueryResult.UserDisplayName,
		)
	})
	if err == nil {
		userServiceLogger.InfoAttrs(ctx, "resent account verification email", slog.String("userEmail", email))

		return nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to resend account verification email",
		slog.String("userEmail", email),
	)

	return exception.NewUnknownException("failed to resend account verification email")
}

func (userService *UserService) verifyAccount(ctx context.Context, verificationCode string) exception.Exception {
	var userEmail string

	err := database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		verificationCodeInfo, err := validateVerificationCode(ctx, transaction, verificationCode)
		userEmail = verificationCodeInfo.Email

		if err != nil {
			if userEmail == "" {
				userEmail = "<NotAvailable>"
			}

			return err
		}

		return userRepository.setUserStatusToActive(ctx, transaction, verificationCodeInfo.UserId)
	})
	if err == nil {
		userServiceLogger.InfoAttrs(ctx, "account was verified", slog.String("userEmail", userEmail))

		return nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to verify account",
		slog.String("userEmail", userEmail),
		slog.String("code", verificationCode),
	)

	return exception.GetAsApplicationException(err, "failed to verify account")
}

func validateVerificationCode(
	ctx context.Context,
	transaction pgx.Tx,
	verificationCode string,
) (model.VerificationCodeQueryResult, error) {
	verificationCode = strings.TrimSpace(verificationCode)
	if verificationCode == "" {
		return model.VerificationCodeQueryResult{},
			exception.NewValidationException("verification code is empty")
	}

	verificationCodeQueryResult, err := userRepository.FindVerificationCodeInfoById(ctx, transaction, verificationCode)
	if err != nil {
		if database.IsEmptyResultError(err) {
			return model.VerificationCodeQueryResult{},
				exception.NewValidationException("verification code does not exist")
		}

		return model.VerificationCodeQueryResult{}, err
	}

	if verificationCodeQueryResult.IsExpired() {
		_ = userRepository.deleteVerificationCodeEntry(ctx, transaction, verificationCode)

		return verificationCodeQueryResult,
			exception.NewValidationException("verification code has expired")
	}

	err = userRepository.deleteVerificationCodeEntry(ctx, transaction, verificationCode)
	if err == nil {
		return verificationCodeQueryResult, nil
	}

	return verificationCodeQueryResult, err
}

func (userService *UserService) login(
	ctx context.Context,
	payload *dto.LoginRequestPayload,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, exception.Exception) {
	authenticatedUser, err := login(ctx, payload, userIp, userAgent)
	if err == nil {
		return authenticatedUser, nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to log in",
		slog.String("userEmail", payload.Email),
	)

	return nil, exception.GetAsApplicationException(err, "failed to log in")
}

func login(
	ctx context.Context,
	payload *dto.LoginRequestPayload,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	foundUser, err := user.FindUserByEmail(ctx, nil, payload.Email)
	if err != nil {
		if database.IsEmptyResultError(err) {
			return nil, userException.NewIncorrectEmailOrPasswordException()
		}

		return nil, err
	}

	if foundUser.Provider != model.Oauth2ProviderNone {
		return nil,
			userException.NewEmailPasswordLoginNotAllowedForOauth2UserException(foundUser.Email, foundUser.Provider)
	}

	switch foundUser.Status {
	case model.UserStatusActive, model.UserStatusInactive:
		return checkPasswordAndLogin(ctx, &foundUser, payload.Password, userIp, userAgent)

	case model.UserStatusBlocked, model.UserStatusPermanentlyBlocked:
		userServiceLogger.InfoAttrs(
			ctx,
			"user is blocked, canceling login flow",
			slog.String("userEmail", foundUser.Email),
		)

		return nil, userException.NewUserIsBlockedException(foundUser.StatusReason)

	case model.UserStatusUnverified:
		if !hasUserPassedEmailVerificationWindow(&foundUser, VerificationGracePeriodInDays) {
			return checkPasswordAndLogin(ctx, &foundUser, payload.Password, userIp, userAgent)
		}

		userServiceLogger.InfoAttrs(
			ctx,
			"user has passed account verification window, blocking their access permanently now",
			slog.String("userEmail", foundUser.Email),
		)

		err = userRepository.blockUserPermanently(
			ctx,
			&foundUser,
			model.UserStatusReasonUnverifiedEmail,
		)
		if err == nil {
			userServiceLogger.InfoAttrs(
				ctx,
				"permanently blocking user due to unverified email",
				slog.String("userEmail", foundUser.Email),
			)

			sendAccountIsPermanentlyDiabledDueToUnverificationEmail(ctx, &foundUser)

			return nil, userException.NewUserIsBlockedExceptionWithExtra(
				foundUser.StatusReason,
				map[string]any{
					"gracePeriodInDays": VerificationGracePeriodInDays,
				})
		}

		return nil, err
	}

	userServiceLogger.WarnAttrs(
		ctx,
		"unknown user status",
		slog.String("userEmail", foundUser.Email),
		slog.String("userStatus", foundUser.Status.String()),
	)

	return nil, errors.WithStack(errors.Errorf("unknown user status '%v'", foundUser.Status))
}

func checkPasswordAndLogin(
	ctx context.Context,
	user *_jetModel.User,
	passwordToCheck string,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	err := checkPassword(user, passwordToCheck)
	if err == nil {
		authenticatedUser, err := startAuthenticationSession(ctx, user, userIp, userAgent)
		if err != nil {
			return nil, err
		}

		loginAttemptCache.Delete(user.Email)

		userServiceLogger.InfoAttrs(ctx, "logged in user", slog.String("userEmail", user.Email))

		return authenticatedUser, nil
	}

	if !errors.Is(err, userException.ErrWrongPassword) {
		return nil, err
	}

	currentLoginAttempt, ok := loginAttemptCache.Get(user.Email)
	if !ok {
		currentLoginAttempt = 0
	}

	currentLoginAttempt++

	if currentLoginAttempt < MaxLoginAttemptsAllowed {
		userServiceLogger.WarnAttrs(
			ctx,
			"user did not provide the correct password",
			slog.String("userEmail", user.Email),
		)

		loginAttemptCache.Set(user.Email, currentLoginAttempt)

		return nil, userException.NewIncorrectEmailOrPasswordExceptionWithExtra(
			map[string]any{
				"currentLoginAttempt":     currentLoginAttempt,
				"maxLoginAttemptsAllowed": MaxLoginAttemptsAllowed,
			},
		)
	}

	userServiceLogger.WarnAttrs(
		ctx,
		"user has reached maximum allowed login attempts, blocking their account now",
		slog.String("userEmail", user.Email),
	)

	err = userRepository.BlockUser(ctx, user, model.UserStatusReasonTooManyFailedLoginAttempts)
	if err == nil {
		loginAttemptCache.Delete(user.Email)

		sendAccountIsBlockedDueToMultipleLoginAttemptsEmail(ctx, user)

		return nil, userException.NewUserIsBlockedException(user.StatusReason)
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to block user who had multiple failed login attempts",
		slog.String("userEmail", user.Email),
	)

	return nil, err

}

func startAuthenticationSession(
	ctx context.Context,
	user *_jetModel.User,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	authenticatedUser, err := establishAuthenticatedUserSession(ctx, user, userIp, userAgent)
	if err != nil {
		return nil, err
	}

	foundSubscription, err := subscription.
		GetSubscriptionService().
		// At this point, the email claim doesn't exist in the JWT yet, so we add it manually
		// in case this method throws an error, it can extract the email claim
		// properly to use in the error log without throwing an error
		FindActiveSubscriptionForUser(context.WithValue(ctx, jwt.JwtClaimEmail, user.Email), user.UserID)
	if err == nil {
		authenticatedUser.Subscription = foundSubscription
	} else if !database.IsEmptyResultError(err) {
		return nil, err
	}

	return authenticatedUser, nil
}

func sendAccountIsBlockedDueToMultipleLoginAttemptsEmail(ctx context.Context, user *_jetModel.User) {
	emailMessageBuilder := email.
		NewEmailBuilder().
		WithSubject("Your account has been blocked").
		WithDestinationEmail(user.Email).
		WithEmailFile("account-is-blocked-due-to-failed-logins.html").
		SetTemplateVariable("UserDisplayName", user.DisplayName).
		SetTemplateVariable("UserEmail", user.Email)

	messageId, err := email.SendSecurityAlertEmail(emailMessageBuilder)
	if err != nil {
		userServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to send email after blocking user due to multiple login attempts",
			slog.String("userEmail", user.Email),
			slog.String("messageId", messageId),
		)
	}
}

func hasUserPassedEmailVerificationWindow(user *_jetModel.User, verificationGracePeriodInDays byte) bool {
	gracePeriodDaysInHours := verificationGracePeriodInDays * 24

	return time.Since(user.CreatedAt).Hours() >= float64(gracePeriodDaysInHours)
}

func sendAccountIsPermanentlyDiabledDueToUnverificationEmail(ctx context.Context, user *_jetModel.User) {
	emailMessageBuilder := email.
		NewEmailBuilder().
		WithSubject("Your account has been permanently disabled").
		WithDestinationEmail(user.Email).
		WithEmailFile("permanently-disabled-unverified-account.html").
		SetTemplateVariable("UserDisplayName", user.DisplayName).
		SetTemplateVariable("UserEmail", user.Email)

	messageId, err := email.SendSecurityAlertEmail(emailMessageBuilder)
	if err != nil {
		userServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to send email after permanently disable user due to failue to verify account",
			slog.String("userEmail", user.Email),
			slog.String("messageId", messageId),
		)
	}
}

func (userService *UserService) restoreUserSession(
	ctx context.Context,
	sessionId string,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, exception.Exception) {
	restoredAuthenticatedUser, err := restoreUserSession(ctx, sessionId, userIp, userAgent)
	if restoredAuthenticatedUser != nil {
		return restoredAuthenticatedUser, nil
	}

	if err != nil {
		userServiceLogger.ErrorAttrs(
			ctx,
			err,
			"failed to restore user session",
			slog.String("sessionId", sessionId),
		)

		if exception.IsApplicationException(err) {
			return nil, err.(exception.Exception)
		}
	}

	return nil, exception.NewNotFoundException("no existing session was found")
}

func restoreUserSession(
	ctx context.Context,
	sessionId string,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	aesGcm, _, err := createAesGcmCipher(false)
	if err != nil {
		return nil, err
	}

	nonceLength := aesGcm.NonceSize() * 2
	nonce := sessionId[0:nonceLength]
	nonceBytes, err := hex.DecodeString(nonce)
	if err != nil {
		return nil, err
	}

	encryptedPayload := sessionId[nonceLength:]
	encryptedPayloadBytes, err := hex.DecodeString(encryptedPayload)
	if err != nil {
		return nil, err
	}

	decryptedUserSessionBytes, err := aesGcm.Open(nil, nonceBytes, encryptedPayloadBytes, nil)
	if err != nil {
		return nil, err
	}

	var userSession dto.UserSession
	err = json.Unmarshal(decryptedUserSessionBytes, &userSession)
	if err != nil {
		return nil, err
	}

	// Reusing the existing session ID because we don't want users to keep extending their session
	userSession.Id = sessionId

	restoredAuthenticatedUser, err := loginUserFromPreviousSession(ctx, &userSession, userIp, userAgent)
	if restoredAuthenticatedUser != nil {
		return restoredAuthenticatedUser, nil
	}

	return nil, err
}

func loginUserFromPreviousSession(
	ctx context.Context,
	userSession *dto.UserSession,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	if userSession.Ip != userIp {
		userServiceLogger.WarnAttrs(
			ctx,
			"user IP in decrypted user session does not match the provided user IP",
			slog.String("userEmail", userSession.Email),
			slog.String("userIp", userIp),
		)

		return nil, nil
	}

	if userSession.UserAgent != userAgent {
		userServiceLogger.WarnAttrs(
			ctx,
			"user agent in decrypted user session does not match the provided user agent",
			slog.String("userEmail", userSession.Email),
			slog.String("userAgent", userAgent),
		)

		return nil, nil
	}

	if userSession.IsExpired() {
		userServiceLogger.DebugAttrs(
			ctx,
			"user session has expired",
			slog.String("userEmail", userSession.Email),
			slog.String("userIp", userIp),
			slog.Time("expiresAt", userSession.ExpiresAt),
		)

		return nil, nil
	}

	foundUser, err := user.FindUserById(ctx, nil, userSession.UserId)
	if err != nil {
		return nil, err
	}

	if foundUser.Status == model.UserStatusActive ||
		(foundUser.Status == model.UserStatusUnverified &&
			!hasUserPassedEmailVerificationWindow(&foundUser, VerificationGracePeriodInDays)) {
		return startAuthenticationSession(ctx, &foundUser, userIp, userAgent)
	}

	return nil, nil
}

func (userService *UserService) requestPasswordReset(
	ctx context.Context,
	payload *dto.PasswordResetRequestPayload,
) exception.Exception {
	err := database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		foundUser, err := user.FindUserByEmail(ctx, transaction, payload.Email)
		if err != nil {
			if database.IsEmptyResultError(err) {
				userServiceLogger.ErrorAttrs(
					ctx,
					err,
					"not creating password reset request because no associated user was found with that email",
					slog.String("userEmail", payload.Email),
				)

				return nil
			}

			return err
		}

		if foundUser.Provider != model.Oauth2ProviderNone {
			userServiceLogger.WarnAttrs(
				ctx,
				"resetting password for oauth2 user is not supported",
				slog.String("userEmail", foundUser.Email),
			)

			return userException.NewPasswordResetNotAllowedForOauth2UserException(foundUser.Provider)
		}

		foundVerificationCodeInfo, err := userRepository.FindVerificationCodeInfoByUserIdAndType(
			ctx,
			transaction,
			foundUser.UserID,
			model.VerificationTypePasswordReset,
		)
		if err != nil {
			if !database.IsEmptyResultError(err) {
				return err
			}
		} else if !foundVerificationCodeInfo.IsExpired() {
			userServiceLogger.InfoAttrs(
				ctx,
				fmt.Sprintf(
					"not creating password reset request because an existing request was recently created %v ago",
					time.Since(foundVerificationCodeInfo.CreatedAt),
				),
				slog.String("userEmail", payload.Email),
			)

			return nil
		} else if err = userRepository.deleteVerificationCodeEntry(
			ctx,
			transaction,
			foundVerificationCodeInfo.VerificationCodeId,
		); err != nil {
			return err
		}

		verificationCodeId, err := userRepository.createVerificationCode(
			ctx,
			transaction,
			foundUser.UserID,
			model.VerificationTypePasswordReset,
		)
		if err == nil {
			return sendPasswordResetEmail(ctx, &foundUser, verificationCodeId)
		}

		return err
	})
	if err == nil {
		userServiceLogger.InfoAttrs(ctx, "created password reset request", slog.String("userEmail", payload.Email))

		return nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to create password reset request",
		slog.String("userEmail", payload.Email),
	)

	return exception.GetAsApplicationException(err, "failed to create password reset request")
}

func sendPasswordResetEmail(ctx context.Context, user *_jetModel.User, verificationCodeId string) error {
	emailMessageBuilder := email.
		NewEmailBuilder().
		WithSubject("Password reset").
		WithDestinationEmail(user.Email).
		WithEmailFile("password-reset-request.html").
		SetTemplateVariable("UserDisplayName", user.DisplayName).
		SetTemplateVariable("PasswordResetPath", "/account/reset/verification?code="+verificationCodeId)

	messageId, err := email.SendSecurityAlertEmail(emailMessageBuilder)
	if err == nil {
		userServiceLogger.InfoAttrs(ctx,
			"sent password reset email",
			slog.String("userEmail", user.Email),
			slog.String("verificationCodeId", verificationCodeId),
			slog.String("messageId", messageId),
		)

		return nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send password reset email",
		slog.String("userEmail", user.Email),
		slog.String("verificationCodeId", verificationCodeId),
		slog.String("messageId", messageId),
	)

	return err
}

func (userService *UserService) resetPassword(
	ctx context.Context,
	resetPasswordRequestPayload *dto.ResetPasswordRequestPayload,
) exception.Exception {
	var userEmail string

	err := database.UseTransaction(ctx, func(transaction pgx.Tx) error {
		verificationCodeInfo, err := validateVerificationCode(
			ctx,
			transaction,
			resetPasswordRequestPayload.VerificationCode,
		)
		if err != nil {
			return err
		}

		foundUser, err := user.FindUserById(ctx, transaction, verificationCodeInfo.UserId)
		if err != nil {
			if database.IsEmptyResultError(err) {
				return errors.WithStack(exception.NewNotFoundException("no user was found"))
			}

			return err
		}

		userEmail = foundUser.Email

		saltByteArray, err := hex.DecodeString(foundUser.Salt)
		if err != nil {
			return err
		}

		foundUser.Password = hashAndStringifyPassword(resetPasswordRequestPayload.Password, saltByteArray)

		if foundUser.Status != model.UserStatusPermanentlyBlocked &&
			foundUser.Status != model.UserStatusUnverified {
			foundUser.Status = model.UserStatusActive
			foundUser.StatusReason = model.UserStatusReasonNone
		} else {
			userServiceLogger.WarnAttrs(
				ctx,
				"not setting user status to active because current status is either permanently blocked or unverified",
				slog.String("userEmail", userEmail),
				slog.String("status", foundUser.Status.String()),
				slog.String("statusReason", foundUser.StatusReason.String()),
			)
		}

		err = userRepository.updateUser(ctx, transaction, &foundUser)
		if err != nil {
			return err
		}

		err = sendPasswordResetConfirmationEmail(ctx, &foundUser)
		if err == nil {
			userServiceLogger.InfoAttrs(ctx, "password was reset", slog.String("userEmail", userEmail))

			return nil
		}

		return err
	})
	if err == nil {
		return nil
	}

	userServiceLogger.ErrorAttrs(ctx, err, "failed to reset password", slog.String("userEmail", userEmail))

	return exception.GetAsApplicationException(err, "failed to reset password")
}

func sendPasswordResetConfirmationEmail(ctx context.Context, user *_jetModel.User) error {
	emailMessageBuilder := email.
		NewEmailBuilder().
		WithSubject("Your password was reset").
		WithDestinationEmail(user.Email).
		WithEmailFile("password-reset-confirmation.html").
		SetTemplateVariable("UserDisplayName", user.DisplayName).
		SetTemplateVariable("UserEmail", user.Email)

	messageId, err := email.SendSecurityAlertEmail(emailMessageBuilder)
	if err == nil {
		userServiceLogger.InfoAttrs(ctx,
			"sent password reset confirmation email",
			slog.String("userEmail", user.Email),
			slog.String("messageId", messageId),
		)

		return nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to send password reset confirmation email",
		slog.String("userEmail", user.Email),
		slog.String("messageId", messageId),
	)

	return err
}

func (userService *UserService) getGoogleAuthorizationUrl(ctx context.Context) (string, string, exception.Exception) {
	return generateOauth2AuthorizationUrl(ctx, getGoogleOauth2Config())
}

func generateOauth2AuthorizationUrl(
	ctx context.Context,
	oauth2Config *oauth2.Config,
) (string, string, exception.Exception) {
	state, err := ulid.Generate()
	if err == nil {
		return oauth2Config.AuthCodeURL(state), state, nil
	}
	userControllerLogger.ErrorAttrs(ctx, err, "failed to generate state")

	return "", "", exception.NewUnknownException("failed to generate authorization url")
}

func getGoogleOauth2Config() *oauth2.Config {
	return &oauth2.Config{
		RedirectURL:  fmt.Sprintf("%s/login/oauth2/google", environment.Config.AccessControlAllowOrigin),
		ClientID:     environment.Config.Oauth2GoogleClientId,
		ClientSecret: environment.Config.Oauth2GoogleClientSecret,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
			"openid",
		},
		Endpoint: google.Endpoint,
	}
}

func (userService *UserService) logInWithGoogle(
	ctx context.Context,
	queryParameters url.Values,
	stateCookie *http.Cookie,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, exception.Exception) {
	authenticatedUser, err := logInWithGoogle(ctx, queryParameters, stateCookie, userIp, userAgent)
	if err == nil {
		userServiceLogger.InfoAttrs(
			ctx,
			"logged in user with google",
			slog.String("userEmail", authenticatedUser.Email),
		)

		return authenticatedUser, nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to log in with google",
		slog.String("userIp", userIp),
		slog.String("userAgent", userAgent),
		slog.String("stateCookieValue", stateCookie.Value),
		slog.String("queryParameters", queryParameters.Encode()),
	)

	return nil, exception.GetAsApplicationException(err, "failed to log in with google")
}

func logInWithGoogle(
	ctx context.Context,
	queryParameters url.Values,
	stateCookie *http.Cookie,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	userInfoPayload, err := getGoogleUserInfo(ctx, queryParameters, stateCookie)
	if err != nil {
		return nil, err
	}

	userStatus := model.UserStatusActive
	if !userInfoPayload.IsEmailVerified {
		userStatus = model.UserStatusUnverified
	}

	foundUser, err := getOrCreateOauth2User(
		ctx,
		userInfoPayload.Email,
		userInfoPayload.DisplayName,
		userStatus,
		model.Oauth2ProviderGoogle,
	)
	if err == nil {
		return logInOauth2User(ctx, foundUser, userIp, userAgent)
	}

	return nil, err
}

func getGoogleUserInfo(
	ctx context.Context,
	queryParameters url.Values,
	stateCookie *http.Cookie,
) (*dto.GoogleUserInfoResponsePayload, error) {
	accessToken, err := exchangeAuthCodeForAccessToken(ctx, getGoogleOauth2Config(), queryParameters, stateCookie)
	if err == nil {
		var userInfoPayload dto.GoogleUserInfoResponsePayload
		err = fetchOauth2UserInfo(
			"https://www.googleapis.com/oauth2/v2/userinfo?access_token="+accessToken,
			&userInfoPayload,
			"",
		)

		return &userInfoPayload, err
	}

	return nil, err
}

func exchangeAuthCodeForAccessToken(
	ctx context.Context,
	oauth2Config *oauth2.Config,
	queryParameters url.Values,
	stateCookie *http.Cookie,
) (string, error) {
	if queryParameters.Get("state") != stateCookie.Value {
		return "", errors.New("provided state did not match state cookie value")
	}

	token, err := oauth2Config.Exchange(ctx, queryParameters.Get("code"))
	if err == nil {
		return token.AccessToken, nil
	}

	return "", err
}

func fetchOauth2UserInfo(userInfoUrl string, userInfoPointer any, bearerToken string) error {
	request, err := http.NewRequest(http.MethodGet, userInfoUrl, nil)
	if err != nil {
		return err
	}

	if bearerToken != "" {
		request.Header.Add("Authorization", "Bearer "+bearerToken)
	}

	userInfoEndpointResponse, err := http.DefaultClient.Do(request)
	if err == nil {
		jsonParser := json.NewDecoder(userInfoEndpointResponse.Body)

		return jsonParser.Decode(userInfoPointer)
	}

	return err
}

func logInOauth2User(
	ctx context.Context,
	user *_jetModel.User,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	switch user.Status {
	case model.UserStatusActive:
		return startAuthenticationSession(ctx, user, userIp, userAgent)

	case model.UserStatusInactive:
		user.Status = model.UserStatusActive
		user.StatusReason = model.UserStatusReasonNone

		err := userRepository.updateUser(ctx, nil, user)
		if err == nil {
			return startAuthenticationSession(ctx, user, userIp, userAgent)
		}

		return nil, err

	case model.UserStatusUnverified:
		if !hasUserPassedEmailVerificationWindow(user, VerificationGracePeriodInDays) {
			return startAuthenticationSession(ctx, user, userIp, userAgent)
		}

		err := userRepository.blockUserPermanently(
			ctx,
			user,
			model.UserStatusReasonUnverifiedEmail,
		)
		if err == nil {
			userServiceLogger.InfoAttrs(
				ctx,
				"permanently blocking oauth2 user due to unverified email",
				slog.String("userEmail", user.Email),
				slog.String("userStatusReason", user.StatusReason.String()),
			)

			sendAccountIsPermanentlyDiabledDueToUnverificationEmail(ctx, user)

			return nil, userException.NewUserIsBlockedException(user.StatusReason)
		}

		return nil, err

	case model.UserStatusBlocked, model.UserStatusPermanentlyBlocked:
		userServiceLogger.InfoAttrs(
			ctx,
			"user is blocked, no login is performed",
			slog.String("userEmail", user.Email),
			slog.String("userStatus", user.Status.String()),
			slog.String("userStatusReason", user.StatusReason.String()),
		)

		return nil, userException.NewUserIsBlockedException(user.StatusReason)
	}

	return nil, errors.WithStack(errors.Errorf("unknown user status '%v'", user.Status))
}

func getOrCreateOauth2User(
	ctx context.Context,
	email string,
	displayName string,
	userStatus model.UserStatus,
	provider model.Oauth2Provider,
) (*_jetModel.User, error) {
	foundUser, err := user.FindUserByEmail(ctx, nil, email)
	if err != nil {
		if database.IsEmptyResultError(err) {
			userId, err := ulid.Generate()
			if err != nil {
				return nil, err
			}

			now := time.Now()
			foundUser = _jetModel.User{
				UserID:         userId,
				Email:          email,
				DisplayName:    displayName,
				Password:       "",
				Salt:           "",
				Status:         userStatus,
				StatusReason:   model.UserStatusReasonNone,
				Provider:       provider,
				LastLoggedInAt: now,
				CreatedAt:      now,
				UpdatedAt:      now,
			}

			err = userRepository.createUser(ctx, nil, &foundUser)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	} else if foundUser.Provider != provider {
		return nil, userException.NewOauth2LoginNotAllowedException(email, foundUser.Provider)
	}

	return &foundUser, nil
}

func (userService *UserService) getFacebookAuthorizationUrl(ctx context.Context) (string, string, exception.Exception) {
	return generateOauth2AuthorizationUrl(ctx, getFacebookOauth2Config())
}

func getFacebookOauth2Config() *oauth2.Config {
	return &oauth2.Config{
		RedirectURL:  fmt.Sprintf("%s/login/oauth2/facebook", environment.Config.AccessControlAllowOrigin),
		ClientID:     environment.Config.Oauth2FacebookClientId,
		ClientSecret: environment.Config.Oauth2FacebookAppSecret,
		Scopes:       []string{"email", "public_profile"},
		Endpoint:     facebook.Endpoint,
	}
}

func (userService *UserService) logInWithFacebook(
	ctx context.Context,
	queryParameters url.Values,
	stateCookie *http.Cookie,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, exception.Exception) {
	authenticatedUser, err := logInWithFacebook(ctx, queryParameters, stateCookie, userIp, userAgent)
	if err == nil {
		userServiceLogger.InfoAttrs(
			ctx,
			"logged in user with facebook",
			slog.String("userEmail", authenticatedUser.Email),
		)

		return authenticatedUser, nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to log in with facebook",
		slog.String("userIp", userIp),
		slog.String("userAgent", userAgent),
		slog.String("stateCookieValue", stateCookie.Value),
		slog.String("queryParameters", queryParameters.Encode()),
	)

	return nil, exception.GetAsApplicationException(err, "failed to log in with facebook")
}

func logInWithFacebook(
	ctx context.Context,
	queryParameters url.Values,
	stateCookie *http.Cookie,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	userInfoPayload, err := getFacebookUserInfo(ctx, queryParameters, stateCookie)
	if err != nil {
		return nil, err
	}

	foundUser, err := getOrCreateOauth2User(
		ctx,
		userInfoPayload.Email,
		userInfoPayload.DisplayName,
		model.UserStatusActive,
		model.Oauth2ProviderFacebook,
	)
	if err == nil {
		return logInOauth2User(ctx, foundUser, userIp, userAgent)
	}

	return nil, err
}

func getFacebookUserInfo(
	ctx context.Context,
	queryParameters url.Values,
	stateCookie *http.Cookie,
) (*dto.FacebookUserInfoResponsePayload, error) {
	accessToken, err := exchangeAuthCodeForAccessToken(
		ctx,
		getFacebookOauth2Config(),
		queryParameters,
		stateCookie,
	)
	if err == nil {
		var userInfoPayload dto.FacebookUserInfoResponsePayload
		err = fetchOauth2UserInfo(
			"https://graph.facebook.com/v13.0/me?fields=id,name,email&access_token="+accessToken,
			&userInfoPayload,
			"",
		)

		return &userInfoPayload, err
	}

	return nil, err
}

func (userService *UserService) getDiscordAuthorizationUrl(ctx context.Context) (string, string, exception.Exception) {
	return generateOauth2AuthorizationUrl(ctx, getDiscordOauth2Config())
}

func getDiscordOauth2Config() *oauth2.Config {
	return &oauth2.Config{
		RedirectURL:  fmt.Sprintf("%s/login/oauth2/discord", environment.Config.AccessControlAllowOrigin),
		ClientID:     environment.Config.Oauth2DiscordClientId,
		ClientSecret: environment.Config.Oauth2DiscordClientSecret,
		Scopes:       []string{"email", "identify", "openid"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  DiscordAuthUrl,
			TokenURL: DiscordTokenUrl,
		},
	}
}

func (userService *UserService) logInWithDiscord(
	ctx context.Context,
	queryParameters url.Values,
	stateCookie *http.Cookie,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, exception.Exception) {
	authenticatedUser, err := logInWithDiscord(ctx, queryParameters, stateCookie, userIp, userAgent)
	if err == nil {
		userServiceLogger.InfoAttrs(
			ctx,
			"logged in user with discord",
			slog.String("userEmail", authenticatedUser.Email),
		)

		return authenticatedUser, nil
	}

	userServiceLogger.ErrorAttrs(
		ctx,
		err,
		"failed to log in with discord",
		slog.String("userIp", userIp),
		slog.String("userAgent", userAgent),
		slog.String("stateCookieValue", stateCookie.Value),
		slog.String("queryParameters", queryParameters.Encode()),
	)

	return nil, exception.GetAsApplicationException(err, "failed to log in with discord")
}

func logInWithDiscord(
	ctx context.Context,
	queryParameters url.Values,
	stateCookie *http.Cookie,
	userIp string,
	userAgent string,
) (*dto.AuthenticatedUser, error) {
	userInfoPayload, err := getDiscordUserInfo(ctx, queryParameters, stateCookie)
	if err != nil {
		return nil, err
	}

	foundUser, err := getOrCreateOauth2User(
		ctx,
		userInfoPayload.Email,
		userInfoPayload.DisplayName,
		model.UserStatusActive,
		model.Oauth2ProviderDiscord,
	)
	if err == nil {
		return logInOauth2User(ctx, foundUser, userIp, userAgent)
	}

	return nil, err
}

func getDiscordUserInfo(
	ctx context.Context,
	queryParameters url.Values,
	stateCookie *http.Cookie,
) (*dto.DiscordUserInfoResponsePayload, error) {
	accessToken, err := exchangeAuthCodeForAccessToken(
		ctx,
		getDiscordOauth2Config(),
		queryParameters,
		stateCookie,
	)
	if err == nil {
		var userInfoPayload dto.DiscordUserInfoResponsePayload
		err = fetchOauth2UserInfo(
			"https://discord.com/api/v10/users/@me",
			&userInfoPayload,
			accessToken,
		)

		return &userInfoPayload, err
	}

	return nil, err
}
