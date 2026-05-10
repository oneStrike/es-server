import {
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/platform/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { CouponRedemptionTargetTypeEnum } from '../../coupon/coupon.constant'
import {
  ClientPlatformEnum,
  ProviderEnvironmentEnum,
} from '../../payment/payment.constant'
import {
  AdProviderEnum,
  AdRewardStatusEnum,
  AdTargetScopeEnum,
} from '../ad-reward.constant'

export class BaseAdProviderConfigDto extends BaseDto {
  @EnumProperty({
    description: '广告 provider（1=穿山甲；2=腾讯优量汇）',
    enum: AdProviderEnum,
    example: AdProviderEnum.PANGLE,
  })
  provider!: AdProviderEnum

  @EnumProperty({
    description: '客户端平台（1=Android；2=iOS；3=HarmonyOS；4=Web；5=小程序）',
    enum: ClientPlatformEnum,
    example: ClientPlatformEnum.ANDROID,
  })
  platform!: ClientPlatformEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.SANDBOX,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: '客户端应用键',
    example: 'default-app',
    required: false,
    default: '',
  })
  clientAppKey?: string

  @StringProperty({
    description: 'provider 应用 ID',
    example: 'pangle-app-id',
    required: false,
    default: '',
  })
  appId?: string

  @StringProperty({
    description: '广告位 key',
    example: 'reward-video-low-price',
  })
  placementKey!: string

  @EnumProperty({
    description: '目标范围（1=低价章节；2=新用户冷启动；3=运营白名单）',
    enum: AdTargetScopeEnum,
    example: AdTargetScopeEnum.LOW_PRICE_CHAPTER,
  })
  targetScope!: AdTargetScopeEnum

  @NumberProperty({
    description: '每日次数上限，0=不限制',
    example: 5,
    min: 0,
    required: false,
    default: 0,
  })
  dailyLimit?: number

  @NumberProperty({
    description: '配置版本',
    example: 1,
    min: 1,
    required: false,
    default: 1,
  })
  configVersion?: number

  @StringProperty({
    description: 'SSV 密钥版本引用',
    example: 'kms://ad/pangle/default/v1',
    maxLength: 160,
  })
  credentialVersionRef!: string

  @StringProperty({
    description: '广告回调地址',
    example: 'https://example.com/ad/callback',
    required: false,
    type: 'url',
  })
  callbackUrl?: string | null

  @ObjectProperty({
    description: '配置摘要，不包含明文密钥',
    example: { keyFingerprint: 'sha256:xxx' },
    required: false,
  })
  configMetadata?: Record<string, unknown> | null

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    required: false,
    default: 0,
  })
  sortOrder?: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
    default: true,
  })
  isEnabled?: boolean
}

export class CreateAdProviderConfigDto extends PickType(
  BaseAdProviderConfigDto,
  [
    'provider',
    'platform',
    'environment',
    'clientAppKey',
    'appId',
    'placementKey',
    'targetScope',
    'dailyLimit',
    'configVersion',
    'credentialVersionRef',
    'callbackUrl',
    'configMetadata',
    'sortOrder',
    'isEnabled',
  ] as const,
) {}

export class UpdateAdProviderConfigDto extends IntersectionType(
  IdDto,
  PartialType(CreateAdProviderConfigDto),
) {}

export class QueryAdProviderConfigDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAdProviderConfigDto, [
      'provider',
      'platform',
      'environment',
      'clientAppKey',
      'placementKey',
      'isEnabled',
    ] as const),
  ),
) {}

export class AdRewardVerificationDto {
  @EnumProperty({
    description: '广告 provider（1=穿山甲；2=腾讯优量汇）',
    enum: AdProviderEnum,
    example: AdProviderEnum.PANGLE,
  })
  provider!: AdProviderEnum

  @EnumProperty({
    description: '客户端平台（1=Android；2=iOS；3=HarmonyOS；4=Web；5=小程序）',
    enum: ClientPlatformEnum,
    example: ClientPlatformEnum.ANDROID,
  })
  platform!: ClientPlatformEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.SANDBOX,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: '客户端应用键',
    example: 'default-app',
    required: false,
    default: '',
  })
  clientAppKey?: string

  @StringProperty({
    description: 'provider 应用 ID',
    example: 'pangle-app-id',
    required: false,
    default: '',
  })
  appId?: string

  @StringProperty({
    description: '广告位 key',
    example: 'reward-video-low-price',
  })
  placementKey!: string

  @EnumProperty({
    description: '目标类型（1=漫画章节；2=小说章节；3=VIP；4=签到）',
    enum: CouponRedemptionTargetTypeEnum,
    example: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
  })
  targetType!: CouponRedemptionTargetTypeEnum

  @NumberProperty({
    description: '目标 ID',
    example: 1,
  })
  targetId!: number

  @StringProperty({
    description: 'provider 奖励唯一 ID',
    example: 'reward-uuid',
  })
  providerRewardId!: string

  @ObjectProperty({
    description: '客户端上下文',
    example: { deviceId: 'device' },
    required: false,
  })
  clientContext?: Record<string, unknown>

  @ObjectProperty({
    description: 'provider 验证 payload',
    example: { sign: 'signature' },
    required: false,
  })
  verifyPayload?: Record<string, unknown>
}

export class AdRewardResultDto extends BaseDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
  })
  userId!: number

  @EnumProperty({
    description: '广告状态（1=奖励成功；2=奖励失败；3=已撤销）',
    enum: AdRewardStatusEnum,
    example: AdRewardStatusEnum.SUCCESS,
  })
  status!: AdRewardStatusEnum

  @StringProperty({
    description: 'provider 奖励唯一 ID',
    example: 'reward-uuid',
  })
  providerRewardId!: string
}
