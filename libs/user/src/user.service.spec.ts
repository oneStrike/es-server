import type { AppUserSelect } from '@db/schema'
import { BusinessErrorCode, GenderEnum } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { UserStatusEnum } from './app-user.constant'
import { UserService } from './user.service'

describe('UserService core mapping contract', () => {
  function createService() {
    const appUserFindFirst = jest.fn()
    const drizzle = {
      db: {
        query: {
          appUser: {
            findFirst: appUserFindFirst,
          },
        },
      },
      buildPage: jest.fn().mockReturnValue({
        pageIndex: 1,
        pageSize: 10,
      }),
      ext: {
        findPagination: jest.fn(),
      },
    }

    const service = new UserService(
      drizzle as never,
      {
        getUserCounts: jest.fn(),
      } as never,
    )

    return {
      service,
      drizzle,
      appUserFindFirst,
    }
  }

  it('maps app user response with growth snapshot defaults and without deletedAt leakage', () => {
    const { service } = createService()
    const user: AppUserSelect = {
      id: 7,
      account: 'user007',
      phoneNumber: '13800000000',
      emailAddress: 'user007@example.com',
      levelId: 3,
      nickname: '测试用户',
      password: 'hashed-password',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      signature: '保持更新',
      bio: '个人简介',
      isEnabled: true,
      genderType: GenderEnum.MALE,
      birthDate: '2000-01-01',
      status: UserStatusEnum.NORMAL,
      banReason: null,
      banUntil: null,
      lastLoginAt: new Date('2026-04-20T08:00:00.000Z'),
      lastLoginIp: '127.0.0.1',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
      deletedAt: new Date('2026-04-22T00:00:00.000Z'),
    }

    const result = service.mapBaseUser(user)

    expect(result).toEqual({
      id: 7,
      account: 'user007',
      phoneNumber: '13800000000',
      emailAddress: 'user007@example.com',
      levelId: 3,
      nickname: '测试用户',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      signature: '保持更新',
      bio: '个人简介',
      isEnabled: true,
      genderType: GenderEnum.MALE,
      birthDate: '2000-01-01',
      points: 0,
      experience: 0,
      status: UserStatusEnum.NORMAL,
      banReason: undefined,
      banUntil: undefined,
      lastLoginAt: new Date('2026-04-20T08:00:00.000Z'),
      lastLoginIp: '127.0.0.1',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
    })
    expect(result).not.toHaveProperty('deletedAt')
  })

  it('builds disabled user status with fallback reason and preserved restriction deadline', () => {
    const { service } = createService()
    const until = new Date('2026-05-01T00:00:00.000Z')

    expect(
      service.buildUserStatus({
        isEnabled: false,
        status: UserStatusEnum.PERMANENT_MUTED,
        banReason: null,
        banUntil: until,
      }),
    ).toEqual({
      isEnabled: false,
      status: UserStatusEnum.PERMANENT_MUTED,
      canLogin: false,
      canPost: false,
      canReply: false,
      canLike: false,
      canFavorite: false,
      canFollow: false,
      reason: '账号已被禁用',
      until,
    })
  })

  it('returns an empty mention page for blank keyword without touching the database', async () => {
    const { service, drizzle } = createService()

    await expect(
      service.queryMentionCandidates({
        q: '   ',
        pageIndex: 2,
        pageSize: 5,
      }),
    ).resolves.toEqual({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 10,
      totalPages: 0,
    })
    expect(drizzle.ext.findPagination).not.toHaveBeenCalled()
  })

  it('throws business error when banned user is blocked from app actions', () => {
    const { service } = createService()

    expect(() =>
      service.ensureAppUserNotBanned({
        status: UserStatusEnum.PERMANENT_BANNED,
        banReason: '违规发言',
        banUntil: null,
      }),
    ).toThrow(BusinessException)

    expect(() =>
      service.ensureAppUserNotBanned({
        status: UserStatusEnum.PERMANENT_BANNED,
        banReason: '违规发言',
        banUntil: null,
      }),
    ).toThrow(
      expect.objectContaining({
        code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message: '账号已被封禁，原因：违规发言，解封时间：永久封禁',
      }),
    )
  })

  it('returns an allowed app user access check result for an active user', async () => {
    const { service, appUserFindFirst } = createService()
    const user = {
      id: 7,
      isEnabled: true,
      status: UserStatusEnum.NORMAL,
      banReason: null,
      banUntil: null,
    }
    appUserFindFirst.mockResolvedValue(user)

    await expect(service.getAppUserAccessCheck(7)).resolves.toEqual({
      allowed: true,
      user,
    })
    expect(appUserFindFirst).toHaveBeenCalledWith({
      where: {
        id: 7,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        isEnabled: true,
        status: true,
        banReason: true,
        banUntil: true,
      },
    })
  })

  it('returns not_found for a missing or deleted app user without throwing', async () => {
    const { service, appUserFindFirst } = createService()
    appUserFindFirst.mockResolvedValue(null)

    await expect(service.getAppUserAccessCheck(7)).resolves.toEqual({
      allowed: false,
      reason: 'not_found',
    })
  })

  it('returns disabled for a disabled app user without throwing', async () => {
    const { service, appUserFindFirst } = createService()
    appUserFindFirst.mockResolvedValue({
      id: 7,
      isEnabled: false,
      status: UserStatusEnum.NORMAL,
      banReason: null,
      banUntil: null,
    })

    await expect(service.getAppUserAccessCheck(7)).resolves.toEqual({
      allowed: false,
      reason: 'disabled',
      message: '账号已被禁用，请联系管理员',
    })
  })

  it('returns banned with the shared ban message without throwing platform exceptions', async () => {
    const { service, appUserFindFirst } = createService()
    appUserFindFirst.mockResolvedValue({
      id: 7,
      isEnabled: true,
      status: UserStatusEnum.PERMANENT_BANNED,
      banReason: '违规发言',
      banUntil: null,
    })

    await expect(service.getAppUserAccessCheck(7)).resolves.toEqual({
      allowed: false,
      reason: 'banned',
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: '账号已被封禁，原因：违规发言，解封时间：永久封禁',
    })
  })
})
