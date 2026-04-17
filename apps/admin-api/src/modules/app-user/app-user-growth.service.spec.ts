import type { DrizzleService } from '@db/core'
import { AppUserGrowthService } from './app-user-growth.service'

type AppUserGrowthServicePrivate = AppUserGrowthService & {
  ensureSuperAdmin: (adminUserId: number) => Promise<void>
}

function createDrizzleStub() {
  return {
    db: {},
    schema: {
      adminUser: {
        role: 'role',
      },
      growthLedgerRecord: {
        delta: 'delta',
        userId: 'userId',
        assetType: 'assetType',
        createdAt: 'createdAt',
      },
      userLevelRule: {
        id: 'id',
        name: 'name',
        requiredExperience: 'requiredExperience',
        isEnabled: 'isEnabled',
      },
      userBadge: {},
      userBadgeAssignment: {},
    },
  } as unknown as DrizzleService
}

describe('appUserGrowthService', () => {
  it('uses stable operation key when manually granting experience', async () => {
    const userCoreService = {
      ensureUserExists: jest.fn().mockResolvedValue({ id: 18 }),
    }
    const userExperienceService = {
      addExperience: jest.fn().mockResolvedValue(true),
    }

    const service = new AppUserGrowthService(
      createDrizzleStub(),
      userCoreService as never,
      {} as never,
      userExperienceService as never,
      {} as never,
      {} as never,
    )
    const privateService = service as unknown as AppUserGrowthServicePrivate

    jest
      .spyOn(privateService, 'ensureSuperAdmin')
      .mockResolvedValue(undefined)

    await service.addAppUserExperience(9, {
      userId: 18,
      operationKey: 'manual-growth-20260417-001',
      ruleType: 1,
      remark: '管理员补发经验',
    })

    expect(userCoreService.ensureUserExists).toHaveBeenCalledWith(18)
    expect(userExperienceService.addExperience).toHaveBeenCalledWith({
      userId: 18,
      operationKey: 'manual-growth-20260417-001',
      ruleType: 1,
      remark: '管理员补发经验',
      bizKey:
        'app-user:experience:add:admin:9:user:18:operation:manual-growth-20260417-001',
      source: 'admin_app_user_module',
    })
  })
})
