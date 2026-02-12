import {
  ValidateArray,
  ValidateBoolean,
  ValidateDate,
  ValidateNested,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { UserLevelInfoDto } from '../../level-rule/dto/level-rule.dto'

export class UserGrowthOverviewBadgeInfoDto {
  @ValidateNumber({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  id!: number

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
    required: false,
    maxLength: 200,
  })
  description?: string

  @ValidateString({
    description: '徽章图标URL',
    example: 'https://example.com/badge.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @ValidateNumber({
    description: '徽章类型',
    example: 1,
    required: true,
  })
  type!: number

  @ValidateNumber({
    description: '排序值',
    example: 0,
    required: true,
  })
  sortOrder!: number

  @ValidateBoolean({
    description: '是否启用',
    example: true,
    required: true,
  })
  isEnabled!: boolean
}

export class UserGrowthOverviewBadgeDto {
  @ValidateNumber({
    description: '用户ID',
    example: 1,
    required: true,
  })
  userId!: number

  @ValidateNumber({
    description: '徽章ID',
    example: 1,
    required: true,
  })
  badgeId!: number

  @ValidateDate({
    description: '获得时间',
    example: '2024-01-01T00:00:00.000Z',
    required: true,
  })
  createdAt!: Date

  @ValidateNested({
    description: '徽章信息',
    type: UserGrowthOverviewBadgeInfoDto,
    required: true,
  })
  badge!: UserGrowthOverviewBadgeInfoDto
}

export class UserGrowthOverviewDto {
  @ValidateNumber({
    description: '积分',
    example: 100,
    required: true,
  })
  points!: number

  @ValidateNumber({
    description: '经验',
    example: 1000,
    required: true,
  })
  experience!: number

  @ValidateNumber({
    description: '等级ID',
    example: 1,
    required: false,
  })
  levelId?: number

  @ValidateNested({
    description: '等级信息',
    type: UserLevelInfoDto,
    required: false,
  })
  levelInfo?: UserLevelInfoDto

  @ValidateArray({
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
