import { UserService } from '../user.service'

describe('userService', () => {
  it('mapBaseUser omits internal deletedAt from outward-facing payload', () => {
    const service = new UserService({} as never, {} as never)

    const result = service.mapBaseUser({
      id: 1,
      account: 'user001',
      phoneNumber: '13800000000',
      emailAddress: 'user@example.com',
      levelId: 2,
      nickname: '张三',
      avatarUrl: 'https://example.com/avatar.png',
      signature: 'hello',
      bio: 'bio',
      isEnabled: true,
      genderType: 1,
      birthDate: '2000-01-01',
      points: 100,
      experience: 300,
      status: 1,
      banReason: null,
      banUntil: null,
      lastLoginAt: new Date('2026-04-01T00:00:00.000Z'),
      lastLoginIp: '127.0.0.1',
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-02T00:00:00.000Z'),
      deletedAt: new Date('2026-04-03T00:00:00.000Z'),
    } as never)

    expect(result).not.toHaveProperty('deletedAt')
  })
})
