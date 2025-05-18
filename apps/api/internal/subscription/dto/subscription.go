package dto

import (
	"time"

	_jetModel "github.com/cloudy-clip/api/internal/common/database/.jet/model"
	"github.com/cloudy-clip/api/internal/subscription/model"
)

type Subscription struct {
	Plan               *Plan                                 `json:"plan"`
	CanceledAt         *time.Time                            `json:"canceledAt"` // Nullable
	CancellationReason *model.SubscriptionCancellationReason `json:"cancellationReason"`
}

func NewSubscription(subscriptionModel _jetModel.Subscription, planDto *Plan) *Subscription {
	return &Subscription{
		Plan:               planDto,
		CanceledAt:         subscriptionModel.CanceledAt,
		CancellationReason: subscriptionModel.CancellationReason,
	}
}
