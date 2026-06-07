import { appUser, appUserCount, userLevelRule } from '@db/schema'
import { AppUserDeletedScopeEnum } from '@libs/user/app-user.constant'
import { AppUserQueryService } from './app-user-query.service'

describe('AppUserQueryService query contract', () => {
  it('builds a createdAt range from startDate/endDate for app user registration filtering', async () => {
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                limit: jest.fn(() => ({
                  offset: jest.fn(async () => []),
                })),
              })),
            })),
          })),
        })
        .mockReturnValue({
          from: jest.fn(() => ({
            where: jest.fn(async () => []),
          })),
        }),
      $count: jest.fn(async () => 0),
    }
    const drizzle = {
      db,
      schema: { appUser, appUserCount, userLevelRule },
      buildPage: jest.fn(() => ({
        pageIndex: 1,
        pageSize: 20,
        limit: 20,
        offset: 0,
      })),
      buildOrderBy: jest.fn(() => ({ orderBySql: [] })),
    }
    const userCoreService = {
      mapBaseUser: jest.fn(),
    }
    const growthBalanceQueryService = {
      getUserGrowthSnapshotMap: jest.fn(async () => new Map()),
    }
    const service = new AppUserQueryService(
      drizzle as never,
      userCoreService as never,
      growthBalanceQueryService as never,
      {} as never,
    )
    const buildDateRange = jest
      .spyOn(
        service as unknown as {
          buildDateRange: (startDate?: string, endDate?: string) => unknown
        },
        'buildDateRange',
      )
      .mockReturnValue(undefined)

    await service.getAppUserPage({
      deletedScope: AppUserDeletedScopeEnum.ACTIVE,
      startDate: '2026-03-01',
      endDate: '2026-03-08',
    })

    expect(buildDateRange).toHaveBeenCalledWith('2026-03-01', '2026-03-08')
  })
})
