/// <reference types="jest" />

import {
  CheckInMakeupPeriodTypeEnum,
} from './check-in.constant'
import { CheckInCalendarReadModelService } from './check-in-calendar-read-model.service'

describe('CheckInCalendarReadModelService admin overview', () => {
  it('returns SQL aggregate counters without loading reward snapshots', async () => {
    const db = buildOverviewDb()
    const service = new CheckInCalendarReadModelService(
      {
        db,
        schema: {
          checkInConfig: {
            configKey: 'check_in_config.config_key',
            id: 'check_in_config.id',
            updatedAt: 'check_in_config.updated_at',
          },
          checkInRecord: {
            id: 'check_in_record.id',
            recordType: 'check_in_record.record_type',
            signDate: 'check_in_record.sign_date',
            userId: 'check_in_record.user_id',
          },
          checkInStreakGrant: {
            id: 'check_in_streak_grant.id',
            triggerSignDate: 'check_in_streak_grant.trigger_sign_date',
          },
        },
      } as never,
      {} as never,
      {
        parseRewardDefinition: jest.fn(),
        resolveRewardForDate: jest.fn(),
      } as never,
      {
        buildMakeupWindow: jest.fn(() => ({
          periodEndDate: '2026-05-31',
          periodKey: 'month-2026-05-01',
          periodStartDate: '2026-05-01',
          periodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
        })),
      } as never,
      {} as never,
    )

    const overview =
      await service.getAdminCalendarOverviewByTargetDate('2026-05-31')

    expect(overview).toEqual({
      cutoffDate: '2026-05-31',
      periodEndDate: '2026-05-31',
      periodKey: 'month-2026-05-01',
      periodStartDate: '2026-05-01',
      periodToDate: {
        makeupSignCount: 5,
        normalSignCount: 14,
        signedCount: 18,
        streakRewardTriggerCount: 3,
      },
      periodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
      targetDay: {
        makeupSignCount: 2,
        normalSignCount: 4,
        signDate: '2026-05-31',
        signedCount: 6,
        streakRewardTriggerCount: 1,
      },
    })
    expect(service['checkInRewardPolicyService'].resolveRewardForDate).not.toHaveBeenCalled()
    expect(db.select).not.toHaveBeenCalledWith(
      expect.objectContaining({
        resolvedRewardItems: expect.anything(),
      }),
    )
    expect(db.select).not.toHaveBeenCalledWith(
      expect.objectContaining({
        resolvedRewardOverviewIconUrl: expect.anything(),
      }),
    )
  })
})

function buildOverviewDb() {
  const select = jest.fn((selection?: Record<string, unknown>) => {
    if (selection?.signedCount) {
      return {
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => ({
              orderBy: jest.fn(() =>
                Promise.resolve([
                  {
                    makeupSignCount: 3,
                    normalSignCount: 10,
                    signDate: '2026-05-30',
                    signedCount: 12,
                  },
                  {
                    makeupSignCount: 2,
                    normalSignCount: 4,
                    signDate: '2026-05-31',
                    signedCount: 6,
                  },
                ]),
              ),
            })),
          })),
        })),
      }
    }

    if (selection?.streakRewardTriggerCount) {
      return {
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            groupBy: jest.fn(() => ({
              orderBy: jest.fn(() =>
                Promise.resolve([
                  {
                    signDate: '2026-05-30',
                    streakRewardTriggerCount: 2,
                  },
                  {
                    signDate: '2026-05-31',
                    streakRewardTriggerCount: 1,
                  },
                ]),
              ),
            })),
          })),
        })),
      }
    }

    return {
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(() =>
            Promise.resolve([
              {
                id: 1,
                isEnabled: 1,
                makeupPeriodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
                periodicAllowance: 2,
              },
            ]),
          ),
        })),
        orderBy: jest.fn(() => ({
          limit: jest.fn(() =>
            Promise.resolve([
              {
                id: 1,
                isEnabled: 1,
                makeupPeriodType: CheckInMakeupPeriodTypeEnum.MONTHLY,
                periodicAllowance: 2,
              },
            ]),
          ),
        })),
      })),
    }
  })

  return {
    select,
  }
}
