import { NumberProperty } from '@libs/platform/decorators'

export class UserPointStatsFieldsDto {
  @NumberProperty({
    description: '当前积分',
    example: 120,
    validation: false,
  })
  currentPoints!: number

  @NumberProperty({
    description: '今日获得积分',
    example: 15,
    validation: false,
  })
  todayEarned!: number

  @NumberProperty({
    description: '今日消耗积分',
    example: 5,
    validation: false,
  })
  todayConsumed!: number
}

export class UserPointDeltaFieldsDto {
  @NumberProperty({
    description: '积分变化（正数为获得，负数为消费）',
    example: 5,
    validation: false,
  })
  points!: number

  @NumberProperty({
    description: '变化前积分',
    example: 100,
    validation: false,
  })
  beforePoints!: number

  @NumberProperty({
    description: '变化后积分',
    example: 105,
    validation: false,
  })
  afterPoints!: number
}

export class UserExperienceDeltaFieldsDto {
  @NumberProperty({
    description: '经验值变化',
    example: 5,
    validation: false,
  })
  experience!: number

  @NumberProperty({
    description: '变化前经验值',
    example: 100,
    validation: false,
  })
  beforeExperience!: number

  @NumberProperty({
    description: '变化后经验值',
    example: 105,
    validation: false,
  })
  afterExperience!: number
}
