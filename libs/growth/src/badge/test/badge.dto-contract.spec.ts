import { existsSync } from 'node:fs'
import * as badge from '@libs/growth/badge'

describe('badge dto contract exports', () => {
  it('exports badge scene DTO contracts from libs', () => {
    expect(badge).toEqual(
      expect.objectContaining({
        AssignUserBadgeDto: expect.any(Function),
        BadgeUserPageItemDto: expect.any(Function),
        BaseUserBadgeAssignmentDto: expect.any(Function),
        BaseUserBadgeDto: expect.any(Function),
        CreateUserBadgeDto: expect.any(Function),
        QueryBadgeUserPageDto: expect.any(Function),
        QueryUserBadgeDto: expect.any(Function),
        UpdateUserBadgeDto: expect.any(Function),
        UpdateUserBadgeStatusDto: expect.any(Function),
        UserBadgeItemDto: expect.any(Function),
        UserBadgeStatisticsDto: expect.any(Function),
      }),
    )
  })

  it('splits base dto files by schema table and removes admin duplicate dto file', () => {
    expect(
      existsSync('libs/growth/src/badge/dto/user-badge.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/badge/dto/user-badge-assignment.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('libs/growth/src/badge/dto/user-badge-management.dto.ts'),
    ).toBe(true)
    expect(
      existsSync('apps/admin-api/src/modules/growth/badge/dto/badge.dto.ts'),
    ).toBe(false)
  })

  it('removes mirrored badge type alias file and keeps dto as the single contract source', () => {
    expect(
      existsSync('libs/growth/src/badge/badge.type.ts'),
    ).toBe(false)
  })
})
