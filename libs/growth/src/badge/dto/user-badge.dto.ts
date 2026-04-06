import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { NumberProperty } from '@libs/platform/decorators/validate/number-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BaseDto } from '@libs/platform/dto/base.dto';
import { UserBadgeTypeEnum } from '../user-badge.constant'

export class BaseUserBadgeDto extends BaseDto {
  @StringProperty({
    description: '徽章名称',
    example: '活跃用户',
    required: true,
    maxLength: 20,
  })
  name!: string

  @StringProperty({
    description: '徽章描述',
    example: '连续登录7天',
    required: false,
    maxLength: 200,
  })
  description?: string | null

  @StringProperty({
    description: '徽章图标URL',
    example: 'https://example.com/badge.png',
    required: false,
    maxLength: 255,
  })
  icon?: string | null

  @StringProperty({
    description: '业务域标识',
    example: 'forum',
    required: false,
    maxLength: 20,
  })
  business?: string | null

  @StringProperty({
    description: '事件键',
    example: 'forum.topic.create',
    required: false,
    maxLength: 50,
  })
  eventKey?: string | null

  @EnumProperty({
    description: '徽章类型（1=系统徽章；2=成就徽章；3=活动徽章）',
    example: UserBadgeTypeEnum.System,
    required: true,
    enum: UserBadgeTypeEnum,
  })
  type!: UserBadgeTypeEnum

  @NumberProperty({
    description: '排序值（数值越小越靠前）',
    example: 0,
    required: true,
    min: 0,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean
}
