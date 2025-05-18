package billing

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/cloudy-clip/api/internal/billing/dto"
	"github.com/cloudy-clip/api/internal/billing/model"
	data "github.com/cloudy-clip/api/test"
	"github.com/cloudy-clip/api/test/debug"
	test "github.com/cloudy-clip/api/test/utils"
)

func TestPaymentApi(t1 *testing.T) {
	test.Integration(t1, func(testServer *httptest.Server) {
		t1.Run("1. return recorded payments", func(t2 *testing.T) {
			sessionCookie, _, usedPaymentMethod := test.StartPaidPlan(t2, testServer, data.LitePlanMonthlyOfferingId)

			payments, total := test.GetPayments(t2, testServer, sessionCookie, 0, 25)
			require.Equal(t2, 1, total)
			require.Len(t2, payments, 1)

			payment := payments[0]

			require.Subset(
				t2,
				payment,
				debug.JsonParse(`
					{
						"subtotal": "%v",
						"discount": "0",
						"tax": "0",
						"amountDue": "%v",
						"currencyCode": "usd",
						"status": "PAID",
						"paymentReason": "NEW_SUBSCRIPTION",
						"paymentMethodLast4": "%v",
						"paymentMethodBrand": "%v"
					}`,
					data.PriceTable[data.LitePlanMonthlyOfferingId],
					data.PriceTable[data.LitePlanMonthlyOfferingId],
					usedPaymentMethod.Last4,
					usedPaymentMethod.Brand,
				),
			)
			require.NotEmpty(t2, test.GetValueFromMap(payment, "paymentId"))
			require.NotEmpty(t2, test.GetValueFromMap(payment, "paidAt"))
		})

		t1.Run("2. paginate recorded payments", func(t2 *testing.T) {
			sessionCookie, testUser, usedPaymentMethod1 := test.StartPaidPlan(
				t2,
				testServer,
				data.LitePlanMonthlyOfferingId,
			)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			time.Sleep(16 * time.Millisecond)

			usedPaymentMethod2 := test.GenerateNonDefaultPaymentMethod(testUser, false)
			test.MockSavingDefaultPaymentMethodOnCustomerRequest(t2, testUser, usedPaymentMethod2)

			test.StartPaidPlanForExistingUser(
				t2,
				testServer,
				testUser,
				data.EssentialPlanMonthlyOfferingId,
				sessionCookie,
				false,
				usedPaymentMethod2,
			)

			_ = test.CancelPaidPlan(t2, testServer, sessionCookie)

			time.Sleep(16 * time.Millisecond)

			usedPaymentMethod3 := test.GenerateNonDefaultPaymentMethod(testUser, false)
			test.MockSavingDefaultPaymentMethodOnCustomerRequest(t2, testUser, usedPaymentMethod3)

			test.StartPaidPlanForExistingUser(
				t2,
				testServer,
				testUser,
				data.LitePlanYearlyOfferingId,
				sessionCookie,
				false,
				usedPaymentMethod3,
			)

			payments, total := test.GetPayments(t2, testServer, sessionCookie, 0, 1)
			require.Equal(t2, 5, total)
			require.Len(t2, payments, 1)

			assertCorrectPayment := func(
				payments []any,
				paymentIndex int,
				usedPaymentMethod *dto.PaymentMethod,
				amountDue int64,
				paymentReason model.PaymentReason,
			) {
				payment := payments[paymentIndex].(map[string]any)
				paymentStatus := "PAID"
				if paymentReason == model.PaymentReasonSubscriptionCancellation {
					paymentStatus = "REFUNDED"
				}

				require.Subset(
					t2,
					payment,
					debug.JsonParse(`
						{
							"subtotal": "%v",
							"discount": "0",
							"tax": "0",
							"amountDue": "%v",
							"currencyCode": "usd",
							"status": "%v",
							"failureReason": null,
							"paymentReason": "%v",
							"paymentMethodLast4": "%v",
							"paymentMethodBrand": "%v"
						}`,
						amountDue,
						amountDue,
						paymentStatus,
						paymentReason.String(),
						usedPaymentMethod.Last4,
						usedPaymentMethod.Brand,
					),
				)
				require.NotEmpty(t2, payment["paymentId"])
				require.NotEmpty(t2, payment["paidAt"])
			}

			assertCorrectPayment(
				payments,
				0,
				usedPaymentMethod3,
				data.PriceTable[data.LitePlanYearlyOfferingId],
				model.PaymentReasonNewSubscription,
			)

			payments, total = test.GetPayments(t2, testServer, sessionCookie, 1, 25)

			require.Equal(t2, 5, total)
			require.Len(t2, payments, 4)

			assertCorrectPayment(
				payments,
				0,
				usedPaymentMethod2,
				-50,
				model.PaymentReasonSubscriptionCancellation,
			)
			assertCorrectPayment(
				payments,
				1,
				usedPaymentMethod2,
				data.PriceTable[data.EssentialPlanMonthlyOfferingId],
				model.PaymentReasonNewSubscription,
			)
			assertCorrectPayment(
				payments,
				2,
				usedPaymentMethod1,
				-50,
				model.PaymentReasonSubscriptionCancellation,
			)
			assertCorrectPayment(
				payments,
				3,
				usedPaymentMethod1,
				data.PriceTable[data.LitePlanMonthlyOfferingId],
				model.PaymentReasonNewSubscription,
			)

			payments, total = test.GetPayments(t2, testServer, sessionCookie, 6, 25)

			require.Equal(t2, 5, total)
			require.Len(t2, payments, 0)
		})

		t1.Run("3. return recorded payments for correct user", func(t2 *testing.T) {
			sessionCookie1, testUser1, _ := test.StartPaidPlan(
				t2,
				testServer,
				data.LitePlanMonthlyOfferingId,
			)

			_ = test.CancelPaidPlan(t1, testServer, sessionCookie1)

			test.StartPaidPlanForExistingUser(
				t2,
				testServer,
				testUser1,
				data.LitePlanMonthlyOfferingId,
				sessionCookie1,
				false,
				test.GetOrCreateDefaultPaymentMethod(testUser1),
			)

			_ = test.CancelPaidPlan(t1, testServer, sessionCookie1)

			sessionCookie2, _, _ := test.StartPaidPlan(
				t2,
				testServer,
				data.EssentialPlanMonthlyOfferingId,
			)

			payments1, total1 := test.GetPayments(t2, testServer, sessionCookie1, 0, 25)

			require.Len(t2, payments1, 4)
			require.Equal(t2, 4, total1)

			payments2, total2 := test.GetPayments(t2, testServer, sessionCookie2, 0, 25)

			require.Len(t2, payments2, 1)
			require.Equal(t2, total2, 1)
		})
	})

}
