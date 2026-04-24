import type { AppUserSelect } from '@db/schema'
import { GenderEnum } from '@libs/platform/constant'
import { UserStatusEnum } from './app-user.constant'
import { UserService } from './user.service'

describe('UserService core mapping contract', () => {
  function createService() {
    const drizzle = {
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
})
