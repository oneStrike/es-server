import { DateProperty } from '@libs/platform/decorators/validate/date-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { IdDto } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  IntersectionType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  ForumUserActionTargetTypeEnum,
  ForumUserActionTypeEnum,
} from '../action-log.constant'

/**
 * 论坛用户操作日志基础 DTO。
 * 严格对应 forum_user_action_log 表字段。
 */
export class BaseForumActionLogDto extends IdDto {
  @NumberProperty({
    description: '关联的用户ID',
    example: 1,
    required: true,
    min: 1,
  })
  userId!: number

  @EnumProperty({
    description: '操作类型',
    example: ForumUserActionTypeEnum.CREATE_TOPIC,
    required: true,
    enum: ForumUserActionTypeEnum,
  })
  actionType!: ForumUserActionTypeEnum

  @EnumProperty({
    description: '操作目标类型',
    example: ForumUserActionTargetTypeEnum.TOPIC,
    required: true,
    enum: ForumUserActionTargetTypeEnum,
  })
  targetType!: ForumUserActionTargetTypeEnum

  @NumberProperty({
    description: '操作目标ID',
    example: 1,
    required: true,
    min: 1,
  })
  targetId!: number

  @StringProperty({
    description: '操作前数据',
    example: '{"title":"旧标题"}',
    required: false,
  })
  beforeData?: string

  @StringProperty({
    description: '操作后数据',
    example: '{"title":"新标题"}',
    required: false,
  })
  afterData?: string

  @StringProperty({
    description: '操作IP地址',
    example: '127.0.0.1',
    required: false,
  })
  ipAddress?: string

  @StringProperty({
    description: '用户代理',
    example:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    required: false,
  })
  userAgent?: string

  @StringProperty({
    description: '操作发生时解析到的国家/地区',
    example: '中国',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoCountry?: string

  @StringProperty({
    description: '操作发生时解析到的省份/州',
    example: '广东省',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoProvince?: string

  @StringProperty({
    description: '操作发生时解析到的城市',
    example: '深圳市',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoCity?: string

  @StringProperty({
    description: '操作发生时解析到的网络运营商',
    example: '电信',
    required: false,
    maxLength: 100,
    validation: false,
  })
  geoIsp?: string

  @StringProperty({
    description: '属地解析来源',
    example: 'ip2region',
    required: false,
    maxLength: 50,
    validation: false,
  })
  geoSource?: string

  @DateProperty({
    description: '创建时间',
    example: '2026-03-19T12:00:00.000Z',
    required: true,
  })
  createdAt!: Date
}

export class CreateForumActionLogDto extends PickType(BaseForumActionLogDto, [
  'userId',
  'actionType',
  'targetType',
  'targetId',
  'geoCountry',
  'geoProvince',
  'geoCity',
  'geoIsp',
  'geoSource',
] as const) {
  @StringProperty({
    description: '操作前数据',
    example: '{"title":"旧标题"}',
    required: false,
  })
  beforeData?: string

  @StringProperty({
    description: '操作后数据',
    example: '{"title":"新标题"}',
    required: false,
  })
  afterData?: string

  @StringProperty({
    description: '操作 IP 地址',
    example: '127.0.0.1',
    required: false,
  })
  ipAddress?: string

  @StringProperty({
    description: '用户代理',
    example: 'Mozilla/5.0',
    required: false,
  })
  userAgent?: string
}

export class QueryForumActionLogDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseForumActionLogDto, [
      'userId',
      'targetId',
      'actionType',
      'targetType',
    ] as const),
  ),
) {}
