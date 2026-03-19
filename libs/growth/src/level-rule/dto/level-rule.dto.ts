import {
  BooleanProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'

/**
 * 等级规则基础DTO
 */
export class BaseUserLevelRuleDto extends BaseDto {
  @StringProperty({
    description: '等级名称',
    example: '新手',
    required: true,
    maxLength: 20,
  })
  name!: string

  @StringProperty({
    description: '等级描述',
    example: '新手用户等级',
    required: false,
    maxLength: 200,
  })
  description?: string

  @StringProperty({
    description: '等级图标URL',
    example: 'https://example.com/icons/level1.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @NumberProperty({
    description: '所需经验值',
    example: 0,
    required: true,
  })
  requiredExperience!: number

  @NumberProperty({
    description: '所需登录天数',
    example: 0,
    required: true,
  })
  loginDays!: number

  @NumberProperty({
    description: '排序值（数值越小越靠前）',
    example: 1,
    required: true,
  })
  sortOrder!: number

  @StringProperty({
    description: '业务域标识',
    example: 'forum',
    required: false,
    maxLength: 20,
  })
  business?: string | null

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @NumberProperty({
    description: '每日发帖数量上限，0表示无限制',
    example: 10,
    required: true,
  })
  dailyTopicLimit!: number

  @NumberProperty({
    description: '每日回复和评论数量上限，0表示无限制',
    example: 50,
    required: true,
  })
  dailyReplyCommentLimit!: number

  @NumberProperty({
    description: '发帖间隔秒数（防刷屏），0表示无限制',
    example: 30,
    required: true,
  })
  postInterval!: number

  @NumberProperty({
    description: '每日点赞次数上限，0表示无限制',
    example: 20,
    required: true,
  })
  dailyLikeLimit!: number

  @NumberProperty({
    description: '每日收藏次数上限，0表示无限制',
    example: 10,
    required: true,
  })
  dailyFavoriteLimit!: number

  @NumberProperty({
    description: '黑名单上限',
    example: 10,
    required: true,
  })
  blacklistLimit!: number

  @NumberProperty({
    description: '作品收藏上限',
    example: 100,
    required: true,
  })
  workCollectionLimit!: number

  @StringProperty({
    description: '积分购买折扣（0-1之间的小数）',
    example: '0.80',
    required: true,
    maxLength: 4,
  })
  discount!: string

  @StringProperty({
    description: '等级专属颜色（十六进制）',
    example: '#FF5733',
    required: false,
    maxLength: 20,
  })
  color?: string

  @StringProperty({
    description: '等级徽章URL',
    example: 'https://example.com/badges/level1.png',
    required: false,
    maxLength: 255,
  })
  badge?: string
}
