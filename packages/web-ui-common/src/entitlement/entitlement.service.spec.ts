/* eslint-disable max-len */
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { LITE_MONTHLY_PLAN } from 'test/data';
import { configureTestingModuleForService, deepCloneObject, startMockingApiRequests } from 'test/utils';
import { generateAuthenticatedUser } from 'test/utils/generate-authenticated-user';

import { UserService } from '../auth';

import { EntitlementService } from './entitlement.service';

describe(EntitlementService.name, () => {
  const TEST_USER_WITHOUT_SUBSCRIPTION = generateAuthenticatedUser();
  const TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION = generateAuthenticatedUser(LITE_MONTHLY_PLAN);
  const apiRequestMockServer = startMockingApiRequests();

  let service: EntitlementService;
  let userService: UserService;

  beforeEach(() => {
    service = configureTestingModuleForService(EntitlementService);
    userService = TestBed.inject(UserService);
  });

  it('#findActiveSubscription() returns empty optional when no logged in user is found', () => {
    expect(service.findActiveSubscription().isEmpty()).toEqual(true);
  });

  it('#findActiveSubscription() returns empty optional when logged-in user has no subscription', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json({
          message: 'OK',
          payload: TEST_USER_WITHOUT_SUBSCRIPTION
        });
      })
    );

    await userService.restoreSession();

    expect(service.findActiveSubscription().isEmpty()).toEqual(true);
    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });

  it('#findActiveSubscription() returns a non-empty optional when logged-in user has an active subscription', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json({
          message: 'OK',
          payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION
        });
      })
    );

    await userService.restoreSession();

    const subscriptionOptional = service.findActiveSubscription();

    expect(subscriptionOptional.isPresent()).toEqual(true);
    expect(subscriptionOptional.orElseThrow().plan.isFreePlan).not.toBeUndefined();
    expect(subscriptionOptional.orElseThrow().plan.entitlements[0]?.enabled).not.toBeUndefined();
    expect(subscriptionOptional.orElseThrow().plan.entitlements[1]?.enabled).not.toBeUndefined();
    expect(subscriptionOptional.orElseThrow().plan.entitlements[2]?.enabled).not.toBeUndefined();

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });

  it('#findActiveSubscription() returns an empty optional when logged-in user has a canceled subscription', async () => {
    const userWithCanceledSubscription = deepCloneObject(TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION);
    userWithCanceledSubscription.subscription!.canceledAt = new Date().toISOString();
    userWithCanceledSubscription.subscription!.cancellationReason = 'REQUESTED_BY_USER';

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json({
          message: 'OK',
          payload: userWithCanceledSubscription
        });
      })
    );

    await userService.restoreSession();

    expect(service.findActiveSubscription().isPresent()).toEqual(false);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });

  it('#findCurrentSubscription() returns empty optional when no logged in user is found', () => {
    expect(service.findCurrentSubscription().isEmpty()).toEqual(true);
  });

  it('#findCurrentSubscription() returns empty optional when logged-in user has no subscription', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json({
          message: 'OK',
          payload: TEST_USER_WITHOUT_SUBSCRIPTION
        });
      })
    );

    await userService.restoreSession();

    expect(service.findCurrentSubscription().isEmpty()).toEqual(true);
    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });

  it('#findCurrentSubscription() returns a non-empty optional when logged-in user has an active subscription', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json({
          message: 'OK',
          payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION
        });
      })
    );

    await userService.restoreSession();

    const subscriptionOptional = service.findCurrentSubscription();

    expect(subscriptionOptional.isPresent()).toEqual(true);
    expect(subscriptionOptional.orElseThrow().plan.isFreePlan).not.toBeUndefined();
    expect(subscriptionOptional.orElseThrow().plan.entitlements[0]?.enabled).not.toBeUndefined();
    expect(subscriptionOptional.orElseThrow().plan.entitlements[1]?.enabled).not.toBeUndefined();
    expect(subscriptionOptional.orElseThrow().plan.entitlements[2]?.enabled).not.toBeUndefined();

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });

  it('#findCurrentSubscription() returns an non-empty optional when logged-in user has a canceled subscription', async () => {
    const userWithCanceledSubscription = deepCloneObject(TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION);
    userWithCanceledSubscription.subscription!.canceledAt = new Date().toISOString();
    userWithCanceledSubscription.subscription!.cancellationReason = 'REQUESTED_BY_USER';

    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json({
          message: 'OK',
          payload: userWithCanceledSubscription
        });
      })
    );

    await userService.restoreSession();

    expect(service.findCurrentSubscription().isPresent()).toEqual(true);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });

  it('#hasActiveSubscription() returns false when no logged in user is found', () => {
    expect(service.hasActiveSubscription()).toEqual(false);
  });

  it('#hasActiveSubscription() returns false when logged-in user has no subscription', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json({
          message: 'OK',
          payload: TEST_USER_WITHOUT_SUBSCRIPTION
        });
      })
    );

    await userService.restoreSession();

    expect(service.hasActiveSubscription()).toEqual(false);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });

  it('#hasActiveSubscription() returns true when logged-in user has an active subscription', async () => {
    apiRequestMockServer.resetHandlers(
      http.get(`${__ORCHESTRATOR_URL__}/v1/users/me/sessions/my`, () => {
        return HttpResponse.json({
          message: 'OK',
          payload: TEST_USER_WITH_LITE_MONTHLY_SUBSCRIPTION
        });
      })
    );

    await userService.restoreSession();

    expect(service.hasActiveSubscription()).toEqual(true);

    expect(HttpClient.prototype.get).toHaveBeenCalledOnce();
  });
});
