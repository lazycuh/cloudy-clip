import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { ESSENTIAL_MONTHLY_PLAN, ESSENTIAL_YEARLY_PLAN, FREE_MONTHLY_PLAN, LITE_MONTHLY_PLAN } from 'test/data';
import {
  configureTestingModuleForService,
  convertToResponsePayload,
  deepCloneObject,
  startMockingApiRequests
} from 'test/utils';

import { PlanListService } from './plan-list.service';

describe(PlanListService.name, () => {
  const apiRequestMockServer = startMockingApiRequests();

  let service: PlanListService;

  beforeEach(() => {
    service = configureTestingModuleForService(PlanListService);
  });

  it('Add "isFreePlan: true" to plan object if it is a free plan', async () => {
    const plans = [
      deepCloneObject(FREE_MONTHLY_PLAN),
      deepCloneObject(LITE_MONTHLY_PLAN),
      deepCloneObject(ESSENTIAL_MONTHLY_PLAN),
      deepCloneObject(ESSENTIAL_YEARLY_PLAN)
    ];

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/plans`, () => {
        return HttpResponse.json(convertToResponsePayload(plans));
      })
    );

    const foundPlans = await service.fetchAllPlans();
    expect(foundPlans).toHaveLength(plans.length);
    expect(foundPlans[0]).toHaveProperty('isFreePlan', true);
    expect(foundPlans[1]).toHaveProperty('isFreePlan', false);
    expect(foundPlans[2]).toHaveProperty('isFreePlan', false);
    expect(foundPlans[3]).toHaveProperty('isFreePlan', false);
  });
});
