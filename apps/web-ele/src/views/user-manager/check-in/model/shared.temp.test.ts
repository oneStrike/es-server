import { describe, expect, it } from 'vitest';

import {
  buildPlanSubmitPayload,
  mapPlanDetailToFormModel,
} from './shared';

describe('check-in shared model temporary contract', () => {
  it('maps detail response dailyRewardRules into form model', () => {
    const formModel = mapPlanDetailToFormModel({
      activeCycleCount: 0,
      allowMakeupCountPerCycle: 2,
      createdAt: '2026-04-09T00:00:00.000Z',
      cycleType: 'weekly',
      dailyRewardRules: [
        {
          dayIndex: 1,
          id: 1,
          rewardConfig: {
            points: 10,
          },
        },
        {
          dayIndex: 3,
          id: 2,
          rewardConfig: {
            experience: 30,
          },
        },
      ],
      id: 1,
      pendingRewardCount: 0,
      planCode: 'growth-check-in',
      planName: '成长签到',
      ruleCount: 1,
      startDate: '2026-04-07',
      status: 0,
      streakRewardRules: [],
      updatedAt: '2026-04-09T00:00:00.000Z',
      version: 1,
    } as any);

    expect(formModel.dailyRewardRules).toEqual([
      expect.objectContaining({
        dayIndex: 1,
        rewardPoints: 10,
      }),
      expect.objectContaining({
        dayIndex: 3,
        rewardExperience: 30,
      }),
    ]);
  });

  it('builds submit payload with dailyRewardRules and no baseRewardConfig', () => {
    const payload = buildPlanSubmitPayload({
      allowMakeupCountPerCycle: 2,
      cycleType: 'weekly',
      dailyRewardRules: [
        {
          dayIndex: 1,
          localId: 'day-1',
          rewardPoints: 10,
        },
      ],
      endDate: '2026-04-13',
      planCode: 'growth-check-in',
      planName: '成长签到',
      startDate: '2026-04-07',
      status: 0,
      streakRewardRules: [],
    } as any);

    expect(payload).toMatchObject({
      allowMakeupCountPerCycle: 2,
      cycleType: 'weekly',
      dailyRewardRules: [
        {
          dayIndex: 1,
          rewardConfig: {
            points: 10,
          },
        },
      ],
      planCode: 'growth-check-in',
      planName: '成长签到',
      startDate: '2026-04-07',
      status: 0,
    });
    expect(payload).not.toHaveProperty('baseRewardConfig');
  });
});
