import {
  ValidateArray,
  ValidateBoolean,
  ValidateNested,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'

export class AliyunSmsConfigDto {
  @ValidateString({
    description: '短信签名',
    example: '阿里云',
  })
  signName!: string

  @ValidateNumber({
    description: '验证码过期时间（秒）',
    example: 300,
  })
  verifyCodeExpire!: number

  @ValidateNumber({
    description: '验证码长度',
    example: 6,
    default: 6,
  })
  verifyCodeLength!: number
}

export class AliyunConfigDto {
  @ValidateString({
    description: 'AccessKey ID (前端输入明文，后端加密存储)',
    example: 'LTAI...',
  })
  accessKeyId!: string

  @ValidateString({
    description: 'AccessKey Secret (前端输入明文，后端加密存储)',
    example: 'secret...',
  })
  accessKeySecret!: string

  @ValidateNested({
    description: '短信配置',
    type: AliyunSmsConfigDto,
  })
  sms!: AliyunSmsConfigDto
}

export class GrowthAntifraudLimitDto {
  @ValidateNumber({
    description: '冷却时间（秒）',
    example: 60,
    required: false,
  })
  cooldownSeconds?: number

  @ValidateNumber({
    description: '每日上限',
    example: 100,
    required: false,
  })
  dailyLimit?: number

  @ValidateNumber({
    description: '总上限',
    example: 1000,
    required: false,
  })
  totalLimit?: number
}

export class GrowthAntifraudEventOverrideDto {
  @ValidateString({
    description: '业务域',
    example: 'forum',
  })
  business!: string

  @ValidateString({
    description: '事件键',
    example: 'forum.topic.create',
  })
  eventKey!: string

  @ValidateNested({
    description: '用户维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  user?: GrowthAntifraudLimitDto

  @ValidateNested({
    description: 'IP 维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  ip?: GrowthAntifraudLimitDto

  @ValidateNested({
    description: '设备维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  device?: GrowthAntifraudLimitDto

  @ValidateNumber({
    description: '积分高价值阈值',
    example: 100,
    required: false,
  })
  pointsThreshold?: number

  @ValidateNumber({
    description: '经验高价值阈值',
    example: 100,
    required: false,
  })
  experienceThreshold?: number

  @ValidateNested({
    description: '高价值用户维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueUser?: GrowthAntifraudLimitDto

  @ValidateNested({
    description: '高价值 IP 维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueIp?: GrowthAntifraudLimitDto

  @ValidateNested({
    description: '高价值设备维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueDevice?: GrowthAntifraudLimitDto
}

export class GrowthAntifraudConfigDto {
  @ValidateBoolean({
    description: '是否启用防刷',
    example: true,
    default: true,
    required: false,
  })
  enabled?: boolean

  @ValidateNested({
    description: '用户维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  user?: GrowthAntifraudLimitDto

  @ValidateNested({
    description: 'IP 维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  ip?: GrowthAntifraudLimitDto

  @ValidateNested({
    description: '设备维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  device?: GrowthAntifraudLimitDto

  @ValidateNumber({
    description: '积分高价值阈值',
    example: 100,
    required: false,
  })
  pointsThreshold?: number

  @ValidateNumber({
    description: '经验高价值阈值',
    example: 100,
    required: false,
  })
  experienceThreshold?: number

  @ValidateNested({
    description: '高价值用户维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueUser?: GrowthAntifraudLimitDto

  @ValidateNested({
    description: '高价值 IP 维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueIp?: GrowthAntifraudLimitDto

  @ValidateNested({
    description: '高价值设备维度限制',
    type: GrowthAntifraudLimitDto,
    required: false,
  })
  highValueDevice?: GrowthAntifraudLimitDto

  @ValidateArray({
    description: '事件级覆盖规则',
    itemType: 'object',
    required: false,
  })
  overrides?: GrowthAntifraudEventOverrideDto[]
}

export class SystemConfigDto {
  @ValidateNested({
    description: '阿里云配置',
    type: AliyunConfigDto,
    required: false,
  })
  aliyunConfig?: AliyunConfigDto

  @ValidateNested({
    description: '成长防刷配置',
    type: GrowthAntifraudConfigDto,
    required: false,
  })
  growthAntifraudConfig?: GrowthAntifraudConfigDto
}
