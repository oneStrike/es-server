import { TokenTypeEnum } from '@libs/platform/modules/auth/token-storage.types'
import { adminUser, adminUserToken } from '../../../schema'
import { seedAdminDomain } from './domain'

describe('seedAdminDomain', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('writes numeric token types for admin tokens', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)

    const insertAdminValues = jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([
        { id: 11, username: 'admin' },
      ]),
    }))
    const insertTokenValues = jest.fn().mockResolvedValue(undefined)

    const db = {
      query: {
        adminUser: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        adminUserToken: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
      insert: jest.fn((table: unknown) => {
        if (table === adminUser) {
          return { values: insertAdminValues }
        }
        if (table === adminUserToken) {
          return { values: insertTokenValues }
        }
        throw new Error('unexpected insert target')
      }),
    }

    await seedAdminDomain(db as never)

    expect(insertTokenValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 11,
        tokenType: TokenTypeEnum.ACCESS,
      }),
    )
  })
})
