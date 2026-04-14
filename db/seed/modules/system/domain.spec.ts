import { ApiTypeEnum } from '@libs/platform/constant/base.constant'
import { requestLog, sensitiveWord, systemConfig } from '../../../schema'
import { seedSystemOperationalData } from './domain'

describe('seedSystemOperationalData', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('writes numeric apiType and standardized actionType', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)

    const limitMock = jest
      .fn()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 101 }])
      .mockResolvedValueOnce([{ id: 102 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    const whereMock = jest.fn(() => ({ limit: limitMock }))
    const orderByMock = jest.fn(() => ({ limit: limitMock }))
    const fromMock = jest.fn(() => ({
      orderBy: orderByMock,
      where: whereMock,
    }))
    const selectMock = jest.fn(() => ({ from: fromMock }))

    const updateSetSystemConfig = jest.fn(() => ({
      where: jest.fn().mockResolvedValue(undefined),
    }))
    const updateSetSensitiveWord = jest.fn(() => ({
      where: jest.fn().mockResolvedValue(undefined),
    }))
    const insertRequestLogValues = jest.fn().mockResolvedValue(undefined)

    const db = {
      query: {
        adminUser: {
          findFirst: jest.fn().mockResolvedValue({ id: 1, username: 'admin' }),
        },
        appUser: {
          findFirst: jest.fn().mockResolvedValue({ id: 2, account: 'reader-a' }),
        },
      },
      select: selectMock,
      update: jest.fn((table: unknown) => {
        if (table === systemConfig) {
          return { set: updateSetSystemConfig }
        }
        if (table === sensitiveWord) {
          return { set: updateSetSensitiveWord }
        }
        throw new Error('unexpected update target')
      }),
      insert: jest.fn((table: unknown) => {
        if (table === requestLog) {
          return { values: insertRequestLogValues }
        }
        throw new Error('unexpected insert target')
      }),
    }

    await seedSystemOperationalData(db as never)

    expect(insertRequestLogValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        apiType: ApiTypeEnum.ADMIN,
        actionType: 3,
      }),
    )
    expect(insertRequestLogValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        apiType: ApiTypeEnum.APP,
        actionType: 3,
      }),
    )
  })
})
