import { userBadge, userLevelRule } from '@db/schema'

jest.mock('@db/core', () => ({
  DrizzleService: class {},
  escapeLikePattern: (value: string) => value,
}))

function createEmptyPage() {
  return {
    list: [],
    total: 0,
    pageIndex: 1,
    pageSize: 20,
    totalPage: 0,
  }
}

describe('growth sort order defaults', () => {
  it('uses sortOrder asc for level rule pagination when orderBy is blank', async () => {
    const { UserLevelRuleService } = await import('./level-rule/level-rule.service')
    const findPagination = jest.fn().mockResolvedValue(createEmptyPage())
    const service = new UserLevelRuleService({
      ext: { findPagination },
      schema: { userLevelRule },
    } as any)

    await service.getLevelRulePage({ orderBy: '   ' } as any)

    expect(findPagination).toHaveBeenCalledWith(
      userLevelRule,
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    )
  })

  it('uses sortOrder asc for badge pagination when orderBy is missing', async () => {
    const { UserBadgeService } = await import('./badge/user-badge.service')
    const findPagination = jest.fn().mockResolvedValue(createEmptyPage())
    const service = new UserBadgeService({
      ext: { findPagination },
      schema: { userBadge },
    } as any)

    await service.getBadges({} as any)

    expect(findPagination).toHaveBeenCalledWith(
      userBadge,
      expect.objectContaining({
        orderBy: { sortOrder: 'asc' },
      }),
    )
  })
})
