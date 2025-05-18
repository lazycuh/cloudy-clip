import { Plan } from '../src/entitlement';

export const FREE_MONTHLY_PLAN = Object.freeze({
  discountedPrice: '0',
  displayName: 'Free',
  entitlements: Object.freeze(
    [
      {
        enabled: true,
        isRestricted: true,
        quantity: 250,
        type: 'WORD_COUNT'
      },
      {
        enabled: false,
        isRestricted: true,
        quantity: 0,
        type: 'IMAGE_UPLOAD'
      },
      {
        enabled: true,
        isRestricted: true,
        quantity: 30,
        type: 'RETENTION_PERIOD'
      }
    ].map(Object.freeze)
  ),
  isFreePlan: true,
  offeringId: '01J9FAJGRYSF5Y1338HSE07SB8',
  planId: '01J7EVJ6F4K87YJVX9JE7ZSZED',
  price: '0',
  renewedIn: '1m'
}) as Plan;

export const LITE_MONTHLY_PLAN = Object.freeze({
  discountedPrice: '199',
  displayName: 'Lite',
  entitlements: Object.freeze(
    [
      {
        enabled: true,
        isRestricted: false,
        quantity: 0,
        type: 'WORD_COUNT'
      },
      {
        enabled: true,
        isRestricted: false,
        quantity: 0,
        type: 'IMAGE_UPLOAD'
      },
      {
        enabled: true,
        isRestricted: true,
        quantity: 30,
        type: 'RETENTION_PERIOD'
      }
    ].map(Object.freeze)
  ),
  isFreePlan: false,
  offeringId: '01J9FAJQBCAFBCG5ZV0JE1NDJA',
  planId: '01J7EVJFS58YH6HSYNCDWJE4JW',
  price: '199',
  renewedIn: '1m'
}) as Plan;

export const ESSENTIAL_MONTHLY_PLAN = Object.freeze({
  discountedPrice: '399',
  displayName: 'Essential',
  entitlements: Object.freeze(
    [
      {
        enabled: true,
        isRestricted: false,
        quantity: 0,
        type: 'WORD_COUNT'
      },
      {
        enabled: true,
        isRestricted: false,
        quantity: 0,
        type: 'IMAGE_UPLOAD'
      },
      {
        enabled: true,
        isRestricted: false,
        quantity: 0,
        type: 'RETENTION_PERIOD'
      }
    ].map(Object.freeze)
  ),
  isFreePlan: false,
  offeringId: '01J9FAJY010PPGWYABP8VSSHCV',
  planId: '01J7EVJNRPXY17SESDS7DY65Y1',
  price: '399',
  renewedIn: '1m'
}) as Plan;

export const FREE_YEARLY_PLAN = Object.freeze({
  discountedPrice: '0',
  displayName: 'Free',
  entitlements: Object.freeze(
    [
      {
        isRestricted: true,
        quantity: 250,
        type: 'WORD_COUNT'
      },
      {
        isRestricted: true,
        quantity: 0,
        type: 'IMAGE_UPLOAD'
      },
      {
        isRestricted: true,
        quantity: 30,
        type: 'RETENTION_PERIOD'
      }
    ].map(Object.freeze)
  ),
  offeringId: '01J9FNB8FZ2XT4NVF9BPQP7Q5G',
  planId: '01J7EVJ6F4K87YJVX9JE7ZSZED',
  price: '0',
  renewedIn: '1y'
}) as Plan;

export const LITE_YEARLY_PLAN = Object.freeze({
  discountedPrice: '1990',
  displayName: 'Lite',
  entitlements: Object.freeze(
    [
      {
        isRestricted: false,
        quantity: 0,
        type: 'WORD_COUNT'
      },
      {
        isRestricted: false,
        quantity: 0,
        type: 'IMAGE_UPLOAD'
      },
      {
        isRestricted: true,
        quantity: 30,
        type: 'RETENTION_PERIOD'
      }
    ].map(Object.freeze)
  ),
  offeringId: '01J9FNBNXCHKKC8686BDM19C59',
  planId: '01J7EVJFS58YH6HSYNCDWJE4JW',
  price: '2388',
  renewedIn: '1y'
}) as Plan;

export const ESSENTIAL_YEARLY_PLAN = Object.freeze({
  discountedPrice: '3990',
  displayName: 'Essential',
  entitlements: Object.freeze(
    [
      {
        enabled: true,
        isRestricted: false,
        quantity: 0,
        type: 'WORD_COUNT'
      },
      {
        enabled: true,
        isRestricted: false,
        quantity: 0,
        type: 'IMAGE_UPLOAD'
      },
      {
        enabled: true,
        isRestricted: false,
        quantity: 0,
        type: 'RETENTION_PERIOD'
      }
    ].map(Object.freeze)
  ),
  isFreePlan: false,
  offeringId: '01J9FNBYVG59GCHESE64WTG30W',
  planId: '01J7EVJNRPXY17SESDS7DY65Y1',
  price: '4788',
  renewedIn: '1y'
}) as Plan;

export const ALL_PLANS = Object.freeze([
  FREE_MONTHLY_PLAN,
  LITE_MONTHLY_PLAN,
  ESSENTIAL_MONTHLY_PLAN,
  FREE_YEARLY_PLAN,
  LITE_YEARLY_PLAN,
  ESSENTIAL_YEARLY_PLAN
]) as Plan[];
