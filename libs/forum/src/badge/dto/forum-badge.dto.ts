import {
  ValidateBoolean,
  ValidateNumber,
  ValidateOptional,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

export class BaseForumBadgeDto extends BaseDto {
  @ValidateString({
    description: '徽章名称',
    example: '活跃用户',
    required: true,
    maxLength: 20,
  })
  name!: string

  @ValidateOptional({
    description: '徽章描述',
    example: '连续登录7天',
    maxLength: 200,
  })
  description?: string

  @ValidateOptional({
    description: '徽章图标URL',
    example: 'https://example.com/badge.png',
    maxLength: 255,
  })
  icon?: string

  @ValidateNumber({
    description: '徽章类型（1=系统徽章, 2=成就徽章, 3=活动徽章）',
    example: 2,
    required: true,
    min: 1,
    max: 3,
  })
  type!: number

  @ValidateOptional({
    description: '排序值（数值越小越靠前）',
    example: 0,
    min: 0,
  })
  order?: number

  @ValidateOptional({
    description: '是否启用',
    example: true,
  })
  isEnabled?: boolean
}

export class CreateForumBadgeDto extends PickType(BaseForumBadgeDto, [
  'name',
  'description',
  'icon',
  'type',
  'order',
  'isEnabled',
]) {}

export class UpdateForumBadgeDto extends IntersectionType(
  PickType(BaseForumBadgeDto, ['id']),
  PartialType(CreateForumBadgeDto),
) {}

export class QueryForumBadgeDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumBadgeDto, ['type', 'isEnabled']),
  ),
) {}

export class AssignBadgeDto {
  @ValidateNumber({
    description: '用户资料ID',
    example: 1,
    required: true,
    min: 1,
  })
  profileId!: number

  @ValidateNumber({
    description: '徽章ID',
    example: 1,
    required: true,
    min: 1,
  })
  badgeId!: number
}

export class RevokeBadgeDto {
  @ValidateNumber({
    description: '用户资料ID',
    example: 1,
    required: true,
    min: 1,
  })
  profileId!: number

  @ValidateNumber({
    description: '徽章ID',
    example: 1,
    required: true,
    min: 1,
  })
  badgeId!: number
}
