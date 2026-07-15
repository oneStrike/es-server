import { NumberProperty, StringProperty } from '@libs/platform/decorators'

/** 用户成长余额快照字段。 */
export class UserGrowthSnapshotFieldsDto {
  @NumberProperty({
    description: '当前积分',
    example: 120,
    default: 0,
    validation: false,
  })
  points!: number

  @NumberProperty({
    description: '当前经验值',
    example: 350,
    default: 0,
    validation: false,
  })
  experience!: number
}

/** 用户积分统计字段。 */
export class UserPointStatsFieldsDto {
  @NumberProperty({ description: '当前积分', example: 120, validation: false })
  currentPoints!: number

  @NumberProperty({ description: '今日获得积分', example: 15, validation: false })
  todayEarned!: number

  @NumberProperty({ description: '今日消耗积分', example: 5, validation: false })
  todayConsumed!: number
}

/** 用户积分变更字段。 */
export class UserPointDeltaFieldsDto {
  @NumberProperty({ description: '积分变化（正数为获得，负数为消费）', example: 5, validation: false })
  points!: number

  @NumberProperty({ description: '变化前积分', example: 100, validation: false })
  beforePoints!: number

  @NumberProperty({ description: '变化后积分', example: 105, validation: false })
  afterPoints!: number
}

/** 用户经验变更字段。 */
export class UserExperienceDeltaFieldsDto {
  @NumberProperty({ description: '经验值变化', example: 5, validation: false })
  experience!: number

  @NumberProperty({ description: '变化前经验值', example: 100, validation: false })
  beforeExperience!: number

  @NumberProperty({ description: '变化后经验值', example: 105, validation: false })
  afterExperience!: number
}

/** 成长事件归一化说明字段。 */
export class UserGrowthRemarkFieldDto {
  @StringProperty({
    description: '按成长事件规则归一化后的说明文案',
    example: '浏览漫画作品',
    required: false,
    validation: false,
  })
  remark?: string
}
