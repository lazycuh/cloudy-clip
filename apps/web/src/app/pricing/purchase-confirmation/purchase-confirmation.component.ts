import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { MatRipple } from '@angular/material/core';
import { RouterLink } from '@angular/router';
import { NotificationService } from '@lazycuh/angular-notification';
import { executeUntil } from '@lazycuh/execute-until';
import { ActionContainerComponent } from '@lazycuh/web-ui-common/action-container';
import { UserService } from '@lazycuh/web-ui-common/auth';
import { EntitlementService } from '@lazycuh/web-ui-common/entitlement';
import { ProgressCompleteIndicatorComponent } from '@lazycuh/web-ui-common/progress-complete-indicator';
import { PulseLoaderComponent } from '@lazycuh/web-ui-common/pulse-loader';
import { BillingService } from 'src/app/user-dashboard/billing-history/services';

import { queryParamSignal } from '@common/query-param-signal';
import { resolveCommonErrorMessage } from '@common/resolve-common-error-message';
import { SubscriptionNotFoundIndicatorComponent } from '@common/subscription-not-found-indicator';
import { Task, TaskService } from '@common/task';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'purchase-confirmation'
  },
  imports: [
    ProgressCompleteIndicatorComponent,
    MatRipple,
    RouterLink,
    ActionContainerComponent,
    SubscriptionNotFoundIndicatorComponent,
    PulseLoaderComponent
  ],
  providers: [EntitlementService, TaskService, BillingService],
  selector: 'lc-purchase-confirmation',
  styleUrl: './purchase-confirmation.component.scss',
  templateUrl: './purchase-confirmation.component.html'
})
export class PurchaseConfirmationComponent {
  protected readonly _isDoneCheckingSubscriptionStatus = signal(false);
  protected readonly _isSuccess = signal(false);

  constructor() {
    const taskService = inject(TaskService);
    const userService = inject(UserService);
    const entitlementService = inject(EntitlementService);
    const billingService = inject(BillingService);
    const notificationService = inject(NotificationService);
    const taskId = queryParamSignal<string>('task', '');

    afterNextRender({
      write: async () => {
        if (!taskId()) {
          this._isDoneCheckingSubscriptionStatus.set(true);
          this._isSuccess.set(entitlementService.hasActiveSubscription());

          return;
        }

        async function getTaskStatus(): Promise<Task['status']> {
          let taskStatus!: Task['status'];

          await executeUntil(
            async () => {
              taskStatus = await taskService.getTaskStatus(taskId());

              return taskStatus !== 'IN_PROGRESS';
            },
            { delayMs: 500, timeoutMs: 15_000 }
          );

          return taskStatus;
        }

        try {
          const taskStatus = await getTaskStatus();

          this._isDoneCheckingSubscriptionStatus.set(true);

          if (taskStatus === 'SUCCESS') {
            this._isSuccess.set(true);
            void userService.restoreSession(true);

            return;
          }

          const latestPayment = (await billingService.findLatestPayment()).orElseThrow();

          if (latestPayment.failureReason === null) {
            return;
          }

          const paymentErrorMessages = (await import('../checkout/models/payment-error-messages')).paymentErrorMessages;

          notificationService.open({
            bypassHtmlSanitization: true,
            content: paymentErrorMessages[latestPayment.failureReason] ?? resolveCommonErrorMessage('')
          });
        } catch {
          this._isSuccess.set(false);
          this._isDoneCheckingSubscriptionStatus.set(true);
        }
      }
    });
  }
}
