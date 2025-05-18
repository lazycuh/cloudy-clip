import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { configureTestingModuleForService, startMockingApiRequests } from 'test/utils';

import { TaskService } from './task.service';

describe(TaskService.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  let service: TaskService;

  beforeEach(() => {
    service = configureTestingModuleForService(TaskService);
  });

  it('Can get task status', async () => {
    const taskId = '1';

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/tasks/${taskId}`, () => {
        return HttpResponse.json({
          payload: {
            failureReason: null,
            status: 'IN_PROGRESS',
            type: 'NEW_SUBSCRIPTION_PAYMENT',
            updatedAt: new Date().toISOString()
          }
        });
      })
    );

    expect(await service.getTaskStatus(taskId)).toBe('IN_PROGRESS');
  });
});
