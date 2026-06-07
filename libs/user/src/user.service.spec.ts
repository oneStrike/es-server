import { BusinessException } from '@libs/platform/exceptions'
import { UserStatusEnum } from './app-user.constant'
import { UserService } from './user.service'

describe('UserService effective app user status', () => {
  function createService() {
    return new UserService({} as never, {} as never)
  }

  it('does not block login when a timed ban has expired', () => {
    const service = createService()
    const expired = new Date(Date.now() - 60_000)

    expect(() =>
      service.ensureAppUserNotBanned({
        status: UserStatusEnum.BANNED,
        banReason: '测试封禁',
        banUntil: expired,
      }),
    ).not.toThrow()
    expect(
      service.buildUserStatus({
        isEnabled: true,
        status: UserStatusEnum.BANNED,
        banReason: '测试封禁',
        banUntil: expired,
      }),
    ).toMatchObject({
      canLogin: true,
      canPost: true,
      canReply: true,
    })
  })

  it('keeps active timed mute from write capabilities while allowing login', () => {
    const service = createService()
    const future = new Date(Date.now() + 60_000)

    const status = service.buildUserStatus({
      isEnabled: true,
      status: UserStatusEnum.MUTED,
      banReason: '测试禁言',
      banUntil: future,
    })

    expect(status).toMatchObject({
      canLogin: true,
      canPost: false,
      canReply: false,
      canLike: true,
    })
  })

  it('keeps permanent ban blocked', () => {
    const service = createService()

    expect(() =>
      service.ensureAppUserNotBanned({
        status: UserStatusEnum.PERMANENT_BANNED,
        banReason: '永久封禁',
        banUntil: null,
      }),
    ).toThrow(BusinessException)
  })
})
