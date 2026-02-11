import {
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { UserBadgeTypeEnum } from '../user-badge.constant'

export class BaseUserBadgeDto extends BaseDto {
  @ValidateString({
    description: '徽章名称',
    example: '活跃用户',
    required: true,
    maxLength: 20,
  })
  name!: string

  @ValidateString({
    description: '徽章描述',
    example: '连续登录7天',
    maxLength: 200,
  })
  description?: string

  @ValidateString({
    description: '徽章图标URL',
    example: 'https://example.com/badge.png',
    maxLength: 255,
  })
  icon?: string

  @ValidateEnum({
    description: '徽章类型（1=系统徽章, 2=成就徽章, 3=活动徽章）',
    example: UserBadgeTypeEnum.System,
    required: true,
    enum: UserBadgeTypeEnum,
  })
  type!: UserBadgeTypeEnum

  @ValidateNumber({
    description: '排序值（数值越小越靠前）',
    example: 0,
    min: 0,
  })
  sortOrder?: number

  @ValidateBoolean({
    description: '是否启用',
    example: true,
  })
  isEnabled?: boolean
}

export class CreateUserBadgeDto extends OmitType(
  BaseUserBadgeDto,
  OMIT_BASE_FIELDS,
) {}

export class UpdateUserBadgeDto extends IntersectionType(
  CreateUserBadgeDto,
  IdDto,
) {}

export class QueryUserBadgeDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseUserBadgeDto, ['name', 'type', 'isEnabled'])),
) {}

export class AssignUserBadgeDto {
  @ValidateNumber({
    description: '徽章id',
    example: 1,
    required: true,
  })
  badgeId!: number

  @ValidateNumber({
    description: '用户id',
    example: 1,
    required: true,
  })
  userId!: number
}
