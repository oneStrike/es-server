import { GrowthAssetTypeEnum } from '../growth-ledger/growth-ledger.constant'
import { GrowthRuleTypeEnum } from '../growth-rule.constant'
import { UserExperienceService } from './experience.service'

describe('UserExperienceService', () => {
  function createService() {
    const appUserFindFirstMock = jest.fn().mockResolvedValue({
      id: 11,
      status: 1,
    })
    const ledgerRecordFindFirstMock = jest.fn().mockResolvedValue({
      id: 88,
    })
    const applyByRuleMock = jest.fn().mockResolvedValue({
      success: true,
      recordId: 88,
    })

    const drizzle = {
      db: {
        query: {
          appUser: {
            findFirst: appUserFindFirstMock,
          },
        },
      },
      withTransaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          query: {
            growthLedgerRecord: {
              findFirst: ledgerRecordFindFirstMock,
            },
          },
        }),
      ),
    }

    const growthLedgerService = {
      applyByRule: applyByRuleMock,
      sanitizePublicContext: jest.fn(),
    }

    const service = new UserExperienceService(
      growthLedgerService as never,
      drizzle as never,
    )

    return {
      service,
      applyByRuleMock,
    }
  }

  it('管理端经验补发在未显式提供 bizKey 时每次都会生成新的业务键', async () => {
    const { service, applyByRuleMock } = createService()

    await service.addExperience({
      userId: 11,
      ruleType: GrowthRuleTypeEnum.ADMIN,
      remark: '管理员补发经验',
      source: 'admin_experience_rule_grant',
      adminUserId: 9001,
    } as never)
    await service.addExperience({
      userId: 11,
      ruleType: GrowthRuleTypeEnum.ADMIN,
      remark: '管理员补发经验',
      source: 'admin_experience_rule_grant',
      adminUserId: 9001,
    } as never)

    expect(applyByRuleMock).toHaveBeenCalledTimes(2)
    expect(applyByRuleMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        userId: 11,
        assetType: GrowthAssetTypeEnum.EXPERIENCE,
        source: 'admin_experience_rule_grant',
        context: expect.objectContaining({
          actorUserId: 9001,
        }),
      }),
    )
    expect(applyByRuleMock.mock.calls[0][1].bizKey).not.toBe(
      applyByRuleMock.mock.calls[1][1].bizKey,
    )
  })

  it('显式传入 bizKey 时会优先复用调用方提供的键', async () => {
    const { service, applyByRuleMock } = createService()

    await service.addExperience({
      userId: 11,
      ruleType: GrowthRuleTypeEnum.ADMIN,
      bizKey: 'experience:manual:fixed-key',
      source: 'admin_experience_rule_grant',
    } as never)

    expect(applyByRuleMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bizKey: 'experience:manual:fixed-key',
      }),
    )
  })
})
