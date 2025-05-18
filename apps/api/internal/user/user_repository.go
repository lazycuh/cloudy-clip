package user

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/cloudy-clip/api/internal/common/database"
	"github.com/cloudy-clip/api/internal/common/ulid"
	"github.com/cloudy-clip/api/internal/user/model"

	"github.com/go-jet/jet/v2/postgres"

	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/common/database/.jet/table"
)

type UserRepository struct {
}

func NewUserRepository() *UserRepository {
	return &UserRepository{}
}

func (userRepository *UserRepository) createUser(
	ctx context.Context,
	transaction pgx.Tx,
	userModel *_jetModel.User,
) error {
	queryBuilder := table.UserTable.
		INSERT(table.UserTable.AllColumns).
		MODEL(userModel)

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (userRepository *UserRepository) createVerificationCode(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
	verificationType model.VerificationType,
) (string, error) {

	verificationCodeId, err := ulid.Generate()
	if err != nil {
		return "", err
	}

	queryBuilder := table.VerificationCodeTable.INSERT(
		table.VerificationCodeTable.VerificationCodeID,
		table.VerificationCodeTable.VerificationType,
		table.VerificationCodeTable.UserID,
	).
		VALUES(verificationCodeId, verificationType, userId)

	return verificationCodeId, database.ExecTx(ctx, transaction, queryBuilder)
}

func (userRepository *UserRepository) updateUser(
	ctx context.Context,
	transaction pgx.Tx,
	updatedUser *_jetModel.User,
) error {
	updatedUser.UpdatedAt = time.Now()

	queryBuilder := table.UserTable.
		UPDATE(table.UserTable.AllColumns).
		MODEL(updatedUser).
		WHERE(table.UserTable.UserID.EQ(postgres.String(updatedUser.UserID)))

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (userRepository *UserRepository) FindVerificationCodeInfoByUserIdAndType(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
	verificationType model.VerificationType) (model.VerificationCodeQueryResult, error) {
	queryBuilder := table.VerificationCodeTable.
		SELECT(
			table.VerificationCodeTable.AllColumns.As(""),
			table.UserTable.Email.AS("email"),
			table.UserTable.DisplayName.AS("display_name"),
		).
		FROM(table.VerificationCodeTable.INNER_JOIN(
			table.UserTable, table.VerificationCodeTable.UserID.EQ(table.UserTable.UserID).AND(
				table.VerificationCodeTable.VerificationType.EQ(postgres.Int16(int16(verificationType))),
			),
		)).
		WHERE(table.VerificationCodeTable.UserID.EQ(postgres.String(userId))).
		LIMIT(1)

	return database.SelectOneTx[model.VerificationCodeQueryResult](ctx, transaction, queryBuilder)
}

func (userRepository *UserRepository) deleteVerificationCodeEntry(
	ctx context.Context,
	transaction pgx.Tx,
	verificationCodeId string,
) error {
	queryBuilder := table.VerificationCodeTable.
		DELETE().
		WHERE(table.VerificationCodeTable.VerificationCodeID.EQ(postgres.String(verificationCodeId)))

	return database.ExecTx(ctx, transaction, queryBuilder)
}

func (userRepository *UserRepository) setUserStatusToActive(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
) error {
	return userRepository.setUserStatus(ctx, transaction, userId, model.UserStatusActive, model.UserStatusReasonNone)
}

func (userRepository *UserRepository) setUserStatus(
	ctx context.Context,
	transaction pgx.Tx,
	userId string,
	status model.UserStatus,
	statusReason model.UserStatusReason,
) error {
	queryBuilder := table.UserTable.
		UPDATE(table.UserTable.Status, table.UserTable.StatusReason, table.UserTable.UpdatedAt).
		SET(status, statusReason, time.Now()).
		WHERE(table.UserTable.UserID.EQ(postgres.String(userId)))

	if transaction != nil {
		return database.ExecTx(ctx, transaction, queryBuilder)
	}

	return database.Exec(ctx, queryBuilder)
}

func (userRepository *UserRepository) FindVerificationCodeInfoById(
	ctx context.Context,
	transaction pgx.Tx,
	verificationCodeId string,
) (model.VerificationCodeQueryResult, error) {
	queryBuilder := table.VerificationCodeTable.
		SELECT(
			table.VerificationCodeTable.AllColumns.As(""),
			table.UserTable.Email.AS("email"),
			table.UserTable.DisplayName.AS("display_name"),
		).
		FROM(table.VerificationCodeTable.INNER_JOIN(
			table.UserTable, table.VerificationCodeTable.UserID.EQ(table.UserTable.UserID),
		)).
		WHERE(table.VerificationCodeTable.VerificationCodeID.EQ(postgres.String(verificationCodeId))).
		LIMIT(1)

	return database.SelectOneTx[model.VerificationCodeQueryResult](ctx, transaction, queryBuilder)
}

func (userRepository *UserRepository) BlockUser(
	ctx context.Context,
	user *_jetModel.User,
	reason model.UserStatusReason,
) error {
	user.Status = model.UserStatusBlocked
	user.StatusReason = reason
	user.UpdatedAt = time.Now()

	return userRepository.setUserStatus(ctx, nil, user.UserID, user.Status, user.StatusReason)
}

func (userRepository *UserRepository) blockUserPermanently(
	ctx context.Context,
	user *_jetModel.User,
	reason model.UserStatusReason,
) error {
	user.Status = model.UserStatusPermanentlyBlocked
	user.StatusReason = reason
	user.UpdatedAt = time.Now()

	return userRepository.setUserStatus(ctx, nil, user.UserID, user.Status, user.StatusReason)
}
