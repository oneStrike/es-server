import { BusinessErrorCode } from '@libs/platform/constant'
import { UnauthorizedException } from '@nestjs/common'
import { ForumPermissionService } from './forum-permission.service'
import type { ForumSectionAccessState } from './forum-permission.type'

type ForumPermissionServicePrivateApi = {
  throwSectionAccessDenied: (accessState: ForumSectionAccessState) => never
}

describe('ForumPermissionService', () => {
  function createServiceHarness() {
    const drizzle = {
      db: {
        query: {
          forumSection: {
            findMany: jest.fn(),
          },
        },
      },
      schema: {},
    }

    return {
      drizzle,
      service: new ForumPermissionService(drizzle as never),
    }
  }

  it('filters out sections whose parent group is not publicly available', async () => {
    const { drizzle, service } = createServiceHarness()

    drizzle.db.query.forumSection.findMany.mockResolvedValue([
      {
        id: 1,
        groupId: null,
        deletedAt: null,
        isEnabled: true,
        userLevelRuleId: null,
        group: null,
        userLevelRule: null,
      },
      {
        id: 2,
        groupId: 10,
        deletedAt: null,
        isEnabled: true,
        userLevelRuleId: null,
        group: {
          isEnabled: false,
          deletedAt: null,
        },
        userLevelRule: null,
      },
    ])

    await expect(service.getAccessibleSectionIds()).resolves.toEqual([1])
  })

  it('maps login-required access denial by explicit code instead of message text', () => {
    const { service } = createServiceHarness()

    expect(() =>
      (
        service as unknown as ForumPermissionServicePrivateApi
      ).throwSectionAccessDenied({
        canAccess: false,
        requiredExperience: 10,
        accessDeniedCode: 'LOGIN_REQUIRED',
        accessDeniedReason: '需要先完成登录校验',
      }),
    ).toThrow(UnauthorizedException)
  })

  it('maps level-required access denial by explicit code instead of message text', () => {
    const { service } = createServiceHarness()

    expect(() =>
      (
        service as unknown as ForumPermissionServicePrivateApi
      ).throwSectionAccessDenied({
        canAccess: false,
        requiredExperience: 1200,
        accessDeniedCode: 'LEVEL_REQUIRED',
        accessDeniedReason: '当前访问等级不足',
      }),
    ).toThrow(
      expect.objectContaining({
        code: BusinessErrorCode.QUOTA_NOT_ENOUGH,
      }),
    )
  })
})
