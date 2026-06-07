import { appUser } from '@db/schema'
import { RevokeTokenReasonEnum } from '@libs/platform/modules/auth/helpers'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { AppUserCommandService } from './app-user-command.service'

function createUpdateDb() {
  return {
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(async () => undefined),
      })),
    })),
  }
}

function createService() {
  const db = createUpdateDb()
  const drizzle = {
    db,
    schema: { appUser },
    withErrorHandling: jest.fn((callback) => callback()),
  }
  const userCoreService = {
    ensureUserExists: jest.fn(async () => ({ id: 7 })),
  }
  const tokenStorage = {
    revokeAllByUserId: jest.fn(async () => undefined),
  }
  const service = new AppUserCommandService(
    drizzle as never,
    userCoreService as never,
    {} as never,
    {} as never,
    {} as never,
    tokenStorage as never,
  )
  jest
    .spyOn(service as unknown as { ensureSuperAdmin: (id: number) => Promise<void> }, 'ensureSuperAdmin')
    .mockResolvedValue(undefined)

  return { service, tokenStorage }
}

describe('AppUserCommandService lifecycle token revocation', () => {
  it('revokes tokens when disabling an app user', async () => {
    const { service, tokenStorage } = createService()

    await service.updateAppUserEnabled(1, { id: 7, isEnabled: false })

    expect(tokenStorage.revokeAllByUserId).toHaveBeenCalledWith(
      7,
      RevokeTokenReasonEnum.ADMIN_REVOKE,
    )
  })

  it('revokes tokens for bans but not mutes', async () => {
    const { service, tokenStorage } = createService()

    await service.updateAppUserStatus(1, {
      id: 7,
      status: UserStatusEnum.MUTED,
      banReason: '测试禁言',
      banUntil: new Date(Date.now() + 60_000),
    })
    expect(tokenStorage.revokeAllByUserId).not.toHaveBeenCalled()

    await service.updateAppUserStatus(1, {
      id: 7,
      status: UserStatusEnum.BANNED,
      banReason: '测试封禁',
      banUntil: new Date(Date.now() + 60_000),
    })
    expect(tokenStorage.revokeAllByUserId).toHaveBeenCalledWith(
      7,
      RevokeTokenReasonEnum.ADMIN_REVOKE,
    )
  })

  it('revokes tokens when soft deleting an app user', async () => {
    const { service, tokenStorage } = createService()

    await service.deleteAppUser(1, 7)

    expect(tokenStorage.revokeAllByUserId).toHaveBeenCalledWith(
      7,
      RevokeTokenReasonEnum.ADMIN_REVOKE,
    )
  })
})
