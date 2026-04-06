import { existsSync, readFileSync } from 'node:fs'
import * as badgeAssignmentDto from '@libs/growth/badge/dto/user-badge-assignment.dto'
import * as badgeManagementDto from '@libs/growth/badge/dto/user-badge-management.dto'
import * as badgeBaseDto from '@libs/growth/badge/dto/user-badge.dto'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

const badge = {
  ...badgeAssignmentDto,
  ...badgeManagementDto,
  ...badgeBaseDto,
}

function readSwaggerMetadata(target: object, propertyKey: string) {
  return {
    propertyKeys:
      Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, target) ?? [],
    propertyMetadata: Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      target,
      propertyKey,
    ),
  }
}

describe('badge dto contract exports', () => {
  it('exports badge scene DTO contracts from owner dto files', () => {
    expect(badge).toEqual(
      expect.objectContaining({
        AssignUserBadgeDto: expect.any(Function),
        BadgeUserPageItemDto: expect.any(Function),
        BaseUserBadgeAssignmentDto: expect.any(Function),
        BaseUserBadgeDto: expect.any(Function),
        CreateUserBadgeDto: expect.any(Function),
        QueryBadgeUserPageDto: expect.any(Function),
        QueryUserBadgeDto: expect.any(Function),
        QueryUserBadgePublicDto: expect.any(Function),
        UpdateUserBadgeDto: expect.any(Function),
        UpdateUserBadgeStatusDto: expect.any(Function),
        UserBadgeItemDto: expect.any(Function),
        UserBadgePublicInfoDto: expect.any(Function),
        UserBadgePublicItemDto: expect.any(Function),
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

  it.each([
    {
      dto: badge.QueryUserBadgePublicDto,
      propertyKey: 'business',
    },
    {
      dto: badge.QueryUserBadgePublicDto,
      propertyKey: 'eventKey',
    },
    {
      dto: badge.UserBadgePublicInfoDto,
      propertyKey: 'business',
    },
    {
      dto: badge.UserBadgePublicInfoDto,
      propertyKey: 'eventKey',
    },
  ])(
    'keeps $propertyKey out of app badge public contract on $dto.name',
    ({ dto, propertyKey }) => {
      const { propertyKeys, propertyMetadata } = readSwaggerMetadata(
        dto.prototype,
        propertyKey,
      )

      expect(propertyKeys).not.toContain(`:${propertyKey}`)
      expect(propertyMetadata).toBeUndefined()
    },
  )

  it('makes app user badge DTO aliases point to public badge contracts', () => {
    const source = readFileSync(
      'apps/app-api/src/modules/user/dto/user.dto.ts',
      'utf8',
    )

    expect(source).toContain('QueryUserBadgePublicDto as QueryMyBadgeDto')
    expect(source).toContain('UserBadgePublicItemDto as UserBadgeItemDto')
  })
})
