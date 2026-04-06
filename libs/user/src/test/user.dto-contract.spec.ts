import { readFileSync } from 'node:fs'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import {
  APP_USER_MANUAL_OPERATION_KEY_REGEX,
  AppUserDeletedScopeEnum,
} from '../app-user.constant'
import { BaseAppUserDto } from '../dto/base-app-user.dto'

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

describe('user dto contract exports', () => {
  it('keeps user dto contracts on owner files instead of user barrel exports', () => {
    const selfSource = readFileSync('libs/user/src/dto/user-self.dto.ts', 'utf8')
    const adminSource = readFileSync(
      'libs/user/src/dto/admin-app-user.dto.ts',
      'utf8',
    )

    expect(selfSource).toContain(
      "import { BaseAppUserCountDto } from './base-app-user-count.dto'",
    )
    expect(selfSource).toContain(
      "import { BaseAppUserDto } from './base-app-user.dto'",
    )
    expect(adminSource).toContain(
      "import { BaseAppUserCountDto } from './base-app-user-count.dto'",
    )
    expect(adminSource).toContain(
      "import { BaseAppUserDto } from './base-app-user.dto'",
    )
  })

  it.each([
    {
      dto: BaseAppUserDto,
      propertyKey: 'deletedAt',
    },
  ])('keeps internal field $propertyKey out of $dto.name', ({ dto, propertyKey }) => {
    const { propertyKeys, propertyMetadata } = readSwaggerMetadata(
      dto.prototype,
      propertyKey,
    )

    expect(propertyKeys).not.toContain(`:${propertyKey}`)
    expect(propertyMetadata).toBeUndefined()
  })

  it('uses mapped types and avoids redundant growth dto facade exports', () => {
    const adminSource = readFileSync(
      'libs/user/src/dto/admin-app-user.dto.ts',
      'utf8',
    )
    const selfSource = readFileSync(
      'libs/user/src/dto/user-self.dto.ts',
      'utf8',
    )

    expect(adminSource).toContain(
      'export class AdminAppUserCountDto extends OmitType(BaseAppUserCountDto, [',
    )
    expect(adminSource).toMatch(
      /export class AdminAppUserPointRecordDto extends OmitType\(\s*BaseUserPointRecordDto,/,
    )
    expect(adminSource).toMatch(
      /export class AdminAppUserExperienceRecordDto extends OmitType\(\s*BaseUserExperienceRecordDto,/,
    )
    expect(adminSource).toMatch(
      /export class AdminAppUserGrowthLedgerRecordDto extends OmitType\(\s*BaseGrowthLedgerRecordDto,/,
    )
    expect(selfSource).toContain(
      'export class UserCountDto extends OmitType(BaseAppUserCountDto, [',
    )
    expect(selfSource).toMatch(
      /export class UserPointRecordDto extends OmitType\(\s*BaseUserPointRecordDto,/,
    )
    expect(selfSource).toMatch(
      /export class UserExperienceRecordDto extends OmitType\(\s*BaseUserExperienceRecordDto,/,
    )
    expect(selfSource).toContain(
      'export class QueryMyPointRecordDto extends OmitType(QueryUserPointRecordDto, [',
    )
    expect(selfSource).toContain(
      "import { BaseUserAssetsSummaryDto } from '@libs/interaction/user-assets/dto/user-assets.dto'",
    )
    expect(selfSource).not.toContain('export class UserAssetsSummaryDto')
    expect(adminSource).toContain("'bizKey'")
    expect(selfSource).toContain("'bizKey'")
    expect(adminSource).toContain('AppUserDeletedScopeEnum')
    expect(adminSource).toContain('APP_USER_MANUAL_OPERATION_KEY_REGEX')
    expect(adminSource).not.toContain('export enum AdminAppUserDeletedScopeEnum')
    expect(adminSource).not.toContain('const ADMIN_APP_USER_OPERATION_KEY_REGEX')
    expect(adminSource).not.toContain('AssignUserBadgeDto as AssignAdminAppUserBadgeDto')
    expect(adminSource).not.toContain('UserBadgeItemDto as AdminAppUserBadgeItemDto')
    expect(adminSource).not.toContain(
      'QueryUserExperienceRecordDto as QueryAdminAppUserExperienceRecordDto',
    )
    expect(adminSource).not.toContain(
      'QueryUserPointRecordDto as QueryAdminAppUserPointRecordDto',
    )
  })

  it('keeps admin app user constants outside dto files and uses numeric enum values', () => {
    expect(AppUserDeletedScopeEnum.ACTIVE).toBe(0)
    expect(AppUserDeletedScopeEnum.DELETED).toBe(1)
    expect(AppUserDeletedScopeEnum.ALL).toBe(2)
    expect(APP_USER_MANUAL_OPERATION_KEY_REGEX.test('manual-growth-20260328-001')).toBe(true)
    expect(APP_USER_MANUAL_OPERATION_KEY_REGEX.test('bad key')).toBe(false)
  })
})
