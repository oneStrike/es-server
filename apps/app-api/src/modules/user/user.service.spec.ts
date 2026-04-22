import { GrowthRuleTypeEnum } from '@libs/growth/growth-rule.constant'
import { UserService } from './user.service'

describe('App UserService ledger record mapping', () => {
  function createService() {
    const userPointService = {
      getPointRecordPage: jest.fn(),
    }
    const userExperienceService = {
      getExperienceRecordPage: jest.fn(),
    }

    const service = new UserService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      userPointService as never,
      userExperienceService as never,
      {} as never,
      {} as never,
    )

    return {
      service,
      userPointService,
      userExperienceService,
    }
  }

  it('strips bizKey and context from point records while preserving remark', async () => {
    const { service, userPointService } = createService()
    userPointService.getPointRecordPage.mockResolvedValue({
      list: [
        {
          id: 1,
          userId: 7,
          ruleId: 10,
          ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
          targetType: 5,
          targetId: 99,
          points: 5,
          beforePoints: 10,
          afterPoints: 15,
          bizKey: 'growth:rule:1',
          remark: '发表帖子',
          context: { targetId: 99 },
          createdAt: new Date('2026-04-22T10:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
      totalPages: 1,
    })

    const page = await service.getUserPointRecords(7, {
      pageIndex: 1,
      pageSize: 20,
    } as never)

    expect(page.list[0]).toEqual({
      id: 1,
      userId: 7,
      ruleId: 10,
      ruleType: GrowthRuleTypeEnum.CREATE_TOPIC,
      targetType: 5,
      targetId: 99,
      points: 5,
      beforePoints: 10,
      afterPoints: 15,
      remark: '发表帖子',
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
    })
  })

  it('strips bizKey, context and updatedAt from experience records while preserving remark', async () => {
    const { service, userExperienceService } = createService()
    userExperienceService.getExperienceRecordPage.mockResolvedValue({
      list: [
        {
          id: 2,
          userId: 7,
          ruleId: 11,
          ruleType: GrowthRuleTypeEnum.COMIC_WORK_VIEW,
          targetType: 1,
          targetId: 8,
          experience: 12,
          beforeExperience: 100,
          afterExperience: 112,
          bizKey: 'growth:rule:100',
          remark: '浏览漫画作品',
          context: { targetId: 8 },
          createdAt: new Date('2026-04-22T10:00:00.000Z'),
          updatedAt: new Date('2026-04-22T11:00:00.000Z'),
        },
      ],
      total: 1,
      pageIndex: 1,
      pageSize: 20,
      totalPages: 1,
    })

    const page = await service.getUserExperienceRecords(7, {
      pageIndex: 1,
      pageSize: 20,
    } as never)

    expect(page.list[0]).toEqual({
      id: 2,
      userId: 7,
      ruleId: 11,
      ruleType: GrowthRuleTypeEnum.COMIC_WORK_VIEW,
      targetType: 1,
      targetId: 8,
      experience: 12,
      beforeExperience: 100,
      afterExperience: 112,
      remark: '浏览漫画作品',
      createdAt: new Date('2026-04-22T10:00:00.000Z'),
    })
  })
})
