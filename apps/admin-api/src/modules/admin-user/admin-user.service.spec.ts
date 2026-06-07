import { adminUser } from '@db/schema'
import { AdminUserRoleEnum } from '@libs/identity/admin-user.constant'
import { BusinessException } from '@libs/platform/exceptions'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { AdminUserService } from './admin-user.service'

function createSelectQueue(rowsQueue: unknown[][]) {
  return jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(async () => rowsQueue.shift() ?? []),
      })),
    })),
  }))
}

function createUpdateDb(selectRows: unknown[][] = []) {
  return {
    select: createSelectQueue(selectRows),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(async () => undefined),
      })),
    })),
    $count: jest.fn(async () => 1),
  }
}

function createService(selectRows: unknown[][] = []) {
  const db = createUpdateDb(selectRows)
  const drizzle = {
    db,
    schema: { adminUser },
    buildPage: jest.fn(),
    buildOrderBy: jest.fn(),
    withErrorHandling: jest.fn((callback) => callback()),
  }
  const scryptService = {
    encryptPassword: jest.fn(async () => 'hashed-password'),
  }
  const tokenStorage = {
    revokeAllByUserId: jest.fn(async () => undefined),
  }
  const service = new AdminUserService(
    drizzle as never,
    scryptService as never,
    {} as never,
    tokenStorage as never,
  )
  jest.spyOn(service, 'isSuperAdmin').mockResolvedValue(undefined)

  return { service, db, scryptService, tokenStorage }
}

describe('AdminUserService account safety', () => {
  it('rejects disabling the last enabled super admin', async () => {
    const { service } = createService([
      [
        {
          id: 2,
          username: 'root',
          mobile: '13800000000',
          role: AdminUserRoleEnum.SUPER_ADMIN,
          isEnabled: true,
        },
      ],
    ])

    await expect(
      service.updateUserInfo(1, {
        id: 2,
        isEnabled: false,
      } as never),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('rejects self downgrade through the generic update endpoint', async () => {
    const { service } = createService([
      [
        {
          id: 1,
          username: 'root',
          mobile: '13800000000',
          role: AdminUserRoleEnum.SUPER_ADMIN,
          isEnabled: true,
        },
      ],
    ])

    await expect(
      service.updateUserInfo(1, {
        id: 1,
        role: AdminUserRoleEnum.NORMAL_ADMIN,
      } as never),
    ).rejects.toBeInstanceOf(BusinessException)
  })

  it('revokes tokens when disabling another admin user', async () => {
    const { service, db, tokenStorage } = createService([
      [
        {
          id: 2,
          username: 'ops',
          mobile: '13800000001',
          role: AdminUserRoleEnum.NORMAL_ADMIN,
          isEnabled: true,
        },
      ],
    ])

    await service.updateUserInfo(1, {
      id: 2,
      isEnabled: false,
    } as never)

    expect(db.update).toHaveBeenCalled()
    expect(tokenStorage.revokeAllByUserId).toHaveBeenCalledWith(
      2,
      RevokeTokenReasonEnum.ADMIN_REVOKE,
    )
  })

  it('returns a generated temporary password on reset and revokes sessions', async () => {
    const { service, scryptService, tokenStorage } = createService()

    const result = await service.resetPassword(1, 2)

    expect(result.temporaryPassword).toEqual(expect.any(String))
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(16)
    expect(scryptService.encryptPassword).toHaveBeenCalledWith(
      result.temporaryPassword,
    )
    expect(scryptService.encryptPassword).not.toHaveBeenCalledWith('Aa@123456')
    expect(tokenStorage.revokeAllByUserId).toHaveBeenCalledWith(
      2,
      RevokeTokenReasonEnum.PASSWORD_CHANGE,
    )
  })
})
