import {
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import {
  BaseDto,
  IdDto,
  OMIT_BASE_FIELDS,
  PageDto,
  UserIdDto,
} from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { ForumBadgeTypeEnum } from '../forum-badge-constant'

/**
 * 论坛徽章基础数据传输对象
 */
export class BaseForumBadgeDto extends BaseDto {
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
    example: ForumBadgeTypeEnum.System,
    required: true,
    enum: ForumBadgeTypeEnum,
  })
  type!: ForumBadgeTypeEnum

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

/**
 * 创建论坛徽章数据传输对象
 */
export class CreateForumBadgeDto extends OmitType(
  BaseForumBadgeDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 更新论坛徽章数据传输对象
 */
export class UpdateForumBadgeDto extends IntersectionType(
  CreateForumBadgeDto,
  IdDto,
) {}
/**
 * 查询论坛徽章数据传输对象
 */
export class QueryForumBadgeDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumBadgeDto, ['name', 'type', 'isEnabled'])),
) {}

/**
 * 分配徽章数据传输对象
 */
export class ProfileBadgeDto {
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
  profileId!: number
}
