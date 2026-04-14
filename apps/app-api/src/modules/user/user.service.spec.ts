import { UserService } from './user.service'

describe('app user service', () => {
  function createSelectChain(result: unknown, options?: { resolveAtWhere?: boolean }) {
    const whereResult = options?.resolveAtWhere
      ? Promise.resolve(result)
      : {
          orderBy: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(result),
          }),
          limit: jest.fn().mockResolvedValue(result),
        }

    return {
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue(whereResult),
      }),
    }
  }

  it('获取用户经验统计时返回等级图标和颜色', async () => {
    const select = jest
      .fn()
      .mockImplementationOnce(() =>
        createSelectChain([{ sum: 12 }], { resolveAtWhere: true }),
      )
      .mockImplementationOnce(() =>
        createSelectChain(
          [
            {
              id: 2,
              name: '进阶用户',
              icon: 'https://cdn.example.com/level-2.png',
              color: '#22AAFF',
              requiredExperience: 100,
            },
          ],
          { resolveAtWhere: true },
        ),
      )
      .mockImplementationOnce(() =>
        createSelectChain([
          {
            id: 3,
            name: '资深用户',
            icon: 'https://cdn.example.com/level-3.png',
            color: '#FF8800',
            requiredExperience: 200,
          },
        ]),
      )
    const service = new UserService(
      {
        db: { select },
        schema: {
          appUser: {},
          userBadgeAssignment: {},
          userBadge: {},
          userLevelRule: {
            id: 'id',
            name: 'name',
            icon: 'icon',
            color: 'color',
            requiredExperience: 'requiredExperience',
            isEnabled: 'isEnabled',
          },
          growthLedgerRecord: {
            delta: 'delta',
            userId: 'userId',
            assetType: 'assetType',
            createdAt: 'createdAt',
          },
        },
      } as never,
      {
        ensureUserExists: jest.fn().mockResolvedValue({
          id: 1,
          levelId: 2,
          experience: 150,
        }),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )

    const result = await service.getUserExperienceStats(1)

    expect(result).toMatchObject({
      currentExperience: 150,
      todayEarned: 12,
      level: {
        id: 2,
        name: '进阶用户',
        icon: 'https://cdn.example.com/level-2.png',
        color: '#22AAFF',
        requiredExperience: 100,
      },
      nextLevel: {
        id: 3,
        name: '资深用户',
        icon: 'https://cdn.example.com/level-3.png',
        color: '#FF8800',
        requiredExperience: 200,
      },
      gapToNextLevel: 50,
    })
  })
})
