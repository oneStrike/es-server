import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  NestedProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { UserLevelInfoDto } from '../../level-rule/dto/level-rule.dto'

export class UserGrowthOverviewBadgeInfoDto {
  @NumberProperty({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  id!: number

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
  description?: string

  @StringProperty({
    description: '徽章图标URL',
    example: 'https://example.com/badge.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @NumberProperty({
    description: '徽章类型',
    example: 1,
    required: true,
  })
  type!: number

  @NumberProperty({
    description: '排序值',
    example: 0,
    required: true,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean
}

export class UserGrowthOverviewBadgeDto {
  @NumberProperty({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @NumberProperty({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  badgeId!: number

  @DateProperty({
    description: '获得时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date

  @NestedProperty({
    description: '徽章信息',
    type: UserGrowthOverviewBadgeInfoDto,
    required: true,
  })
  badge!: UserGrowthOverviewBadgeInfoDto
}

export class UserGrowthOverviewDto {
  @NumberProperty({
    description: '积分',
    example: 100,
    required: true,
  })
  points!: number

  @NumberProperty({
    description: '经验',
    example: 1000,
    required: true,
  })
  experience!: number

  @NumberProperty({
    description: '等级ID',
    example: 1,
    required: false,
  })
  levelId?: number

  @NestedProperty({
    description: '等级信息',
    type: UserLevelInfoDto,
    required: false,
  })
  levelInfo?: UserLevelInfoDto

  @ArrayProperty({
    description: '徽章列表',
    itemType: 'object',
    itemClass: UserGrowthOverviewBadgeDto,
    example: [
      {
        userId: 1,
        badgeId: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        badge: {
          id: 1,
          name: '活跃用户',
          description: '连续登录7天',
          icon: 'https://example.com/badge.png',
          type: 1,
          sortOrder: 0,
          isEnabled: true,
        },
      },
    ],
    required: true,
  })
  badges!: UserGrowthOverviewBadgeDto[]
}
