import type { ExecutionContext } from '@nestjs/common'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { AuthErrorMessages } from '@libs/platform/modules/auth/helpers'
import { UserStatusEnum } from '@libs/user/app-user.constant'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { AppAuthErrorMessages } from './auth.constant'
import { AppUserStatusGuard } from './app-user-status.guard'

function createExecutionContext(sub?: number | string) {
  const handler = () => undefined
  class Controller {}
  const request = sub === undefined ? {} : { user: { sub } }

  return {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext
}

function createGuard() {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  }
  const userCoreService = {
    getAppUserAccessCheck: jest.fn(),
  }
  const guard = new AppUserStatusGuard(
    reflector as never,
    userCoreService as never,
  )

  return {
    guard,
    reflector,
    userCoreService,
  }
}

describe('AppUserStatusGuard', () => {
  it('keeps public route skip behavior unchanged', async () => {
    const { guard, reflector, userCoreService } = createGuard()
    reflector.getAllAndOverride.mockReturnValue(true)

    await expect(guard.canActivate(createExecutionContext(7))).resolves.toBe(
      true,
    )
    expect(userCoreService.getAppUserAccessCheck).not.toHaveBeenCalled()
  })

  it('keeps invalid or absent request.user.sub behavior unchanged', async () => {
    const { guard, userCoreService } = createGuard()

    await expect(guard.canActivate(createExecutionContext())).resolves.toBe(
      true,
    )
    await expect(
      guard.canActivate(createExecutionContext('bad')),
    ).resolves.toBe(true)
    expect(userCoreService.getAppUserAccessCheck).not.toHaveBeenCalled()
  })

  it('maps missing or deleted users to the existing unauthorized login response', async () => {
    const { guard, userCoreService } = createGuard()
    userCoreService.getAppUserAccessCheck.mockResolvedValue({
      allowed: false,
      reason: 'not_found',
    })

    await expect(guard.canActivate(createExecutionContext(7))).rejects.toThrow(
      UnauthorizedException,
    )
    await expect(guard.canActivate(createExecutionContext(7))).rejects.toThrow(
      AuthErrorMessages.LOGIN_INVALID,
    )
  })

  it('maps disabled users to the existing forbidden response', async () => {
    const { guard, userCoreService } = createGuard()
    userCoreService.getAppUserAccessCheck.mockResolvedValue({
      allowed: false,
      reason: 'disabled',
      message: AppAuthErrorMessages.ACCOUNT_DISABLED,
    })

    await expect(guard.canActivate(createExecutionContext(7))).rejects.toThrow(
      ForbiddenException,
    )
    await expect(guard.canActivate(createExecutionContext(7))).rejects.toThrow(
      AppAuthErrorMessages.ACCOUNT_DISABLED,
    )
  })

  it('maps banned users to the existing business error semantics', async () => {
    const { guard, userCoreService } = createGuard()
    userCoreService.getAppUserAccessCheck.mockResolvedValue({
      allowed: false,
      reason: 'banned',
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '账号已被封禁，原因：违规发言，解封时间：永久封禁',
    })

    await expect(
      guard.canActivate(createExecutionContext(7)),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '账号已被封禁，原因：违规发言，解封时间：永久封禁',
    })
    await expect(guard.canActivate(createExecutionContext(7))).rejects.toThrow(
      BusinessException,
    )
  })

  it('allows active users through after the shared app user access check', async () => {
    const { guard, userCoreService } = createGuard()
    userCoreService.getAppUserAccessCheck.mockResolvedValue({
      allowed: true,
      user: {
        id: 7,
        isEnabled: true,
        status: UserStatusEnum.NORMAL,
        banReason: null,
        banUntil: null,
      },
    })

    await expect(guard.canActivate(createExecutionContext('7'))).resolves.toBe(
      true,
    )
    expect(userCoreService.getAppUserAccessCheck).toHaveBeenCalledWith(7)
  })
})
