import {
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log.constant'

/**
 * 论坛用户操作日志基础DTO
 * 包含论坛用户操作日志的所有基础字段定义
 */
export class BaseForumActionLogDto extends BaseDto {
  @ValidateNumber({
    description: '关联的用户资料ID',
    example: 1,
    required: true,
    min: 1,
  })
  profileId!: number

  @ValidateEnum({
    description: '操作类型',
    example: ForumUserActionTypeEnum.CREATE_TOPIC,
    required: true,
    enum: ForumUserActionTypeEnum,
  })
  actionType!: ForumUserActionTypeEnum

  @ValidateEnum({
    description: '操作目标类型',
    example: ForumUserActionTargetTypeEnum.TOPIC,
    required: true,
    enum: ForumUserActionTargetTypeEnum,
  })
  targetType!: ForumUserActionTargetTypeEnum

  @ValidateNumber({
    description: '操作目标ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @ValidateString({
    description: '操作前数据',
    example: '{"title": "旧标题"}',
    required: false,
  })
  beforeData?: string

  @ValidateString({
    description: '操作后数据',
    example: '{"title": "新标题"}',
    required: false,
  })
  afterData?: string

  @ValidateString({
    description: '操作IP地址',
    example: '127.0.0.1',
    required: false,
  })
  ipAddress?: string

  @ValidateString({
    description: '用户代理',
    example:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    required: false,
  })
  userAgent?: string
}

/**
 * 论坛用户操作日志创建DTO
 * 包含创建论坛用户操作日志所需的所有字段定义
 */
export class CreateForumActionLogDto extends OmitType(
  BaseForumActionLogDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 论坛用户操作日志查询DTO
 * 包含查询论坛用户操作日志所需的所有字段定义
 */
export class QueryForumActionLogDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumActionLogDto, [
      'profileId',
      'actionType',
      'targetType',
      'targetId',
    ]),
  ),
) {}
