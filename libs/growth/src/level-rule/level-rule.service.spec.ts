import { BusinessException } from '@libs/platform/exceptions'
import { UserLevelRuleService } from './level-rule.service'

describe('UserLevelRuleService', () => {
  function createService(options?: {
    activeUsers?: number
    levelRuleExists?: boolean
  }) {
    const activeUsers = options?.activeUsers ?? 0
    const levelRuleExists = options?.levelRuleExists ?? true
    const activeUserCountWhereMock = jest
      .fn()
      .mockResolvedValue([{ total: activeUsers }])
    const updateWhereMock = jest.fn().mockResolvedValue({ rowCount: 2 })
    const updateSetMock = jest.fn(() => ({
      where: updateWhereMock,
    }))
    const deleteWhereMock = jest.fn().mockResolvedValue({ rowCount: 1 })
    const tx = {
      query: {
        userLevelRule: {
          findFirst: jest.fn().mockResolvedValue(
            levelRuleExists ? { id: 7 } : undefined,
          ),
        },
      },
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: activeUserCountWhereMock,
        })),
      })),
      update: jest.fn(() => ({
        set: updateSetMock,
      })),
      delete: jest.fn(() => ({
        where: deleteWhereMock,
      })),
    }

    const drizzle = {
      schema: {
        appUser: {
          levelId: 'levelId',
          deletedAt: 'deletedAt',
        },
        userLevelRule: {
          id: 'id',
        },
      },
      withTransaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
      withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
    }

    const service = new UserLevelRuleService(drizzle as never)

    return {
      service,
      tx,
      updateSetMock,
      deleteWhereMock,
    }
  }

  it('活动用户仍引用等级时会拒绝删除', async () => {
    const { service, tx } = createService({ activeUsers: 3 })

    await expect(service.deleteLevelRule(7)).rejects.toThrow(BusinessException)
    await expect(service.deleteLevelRule(7)).rejects.toThrow(
      '该等级规则下还有用户，无法删除',
    )
    expect(tx.update).not.toHaveBeenCalled()
    expect(tx.delete).not.toHaveBeenCalled()
  })

  it('只有软删除用户引用时会先清空 levelId 再删除等级规则', async () => {
    const { service, tx, updateSetMock, deleteWhereMock } = createService({
      activeUsers: 0,
    })

    await expect(service.deleteLevelRule(7)).resolves.toBe(true)

    expect(tx.update).toHaveBeenCalledTimes(1)
    expect(updateSetMock).toHaveBeenCalledWith({ levelId: null })
    expect(tx.delete).toHaveBeenCalledTimes(1)
    expect(deleteWhereMock).toHaveBeenCalledTimes(1)
  })
})
