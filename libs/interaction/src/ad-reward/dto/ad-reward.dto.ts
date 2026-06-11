import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  ObjectProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
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
    description: '客户端平台（1=安卓端；2=苹果端；3=鸿蒙端；4=网页端；5=小程序）',
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
    required: true,
    nullable: true,
    type: 'url',
  })
  callbackUrl!: string | null

  @ObjectProperty({
    description: '配置摘要，不包含明文密钥',
    example: { keyFingerprint: 'sha256:xxx' },
    required: true,
    nullable: true,
    validation: false,
  })
  configMetadata!: Record<string, unknown> | null

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

class AdProviderConfigDefaultOutputFieldsDto {
  @StringProperty({
    description: '客户端应用键',
    example: 'default-app',
    validation: false,
  })
  clientAppKey!: string

  @StringProperty({
    description: 'provider 应用 ID',
    example: 'pangle-app-id',
    validation: false,
  })
  appId!: string

  @NumberProperty({
    description: '每日次数上限，0=不限制',
    example: 5,
    min: 0,
    validation: false,
  })
  dailyLimit!: number

  @NumberProperty({
    description: '配置版本',
    example: 1,
    min: 1,
    validation: false,
  })
  configVersion!: number

  @NumberProperty({
    description: '排序值',
    example: 0,
    min: 0,
    validation: false,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    validation: false,
  })
  isEnabled!: boolean
}

export class AdProviderConfigOutputDto extends IntersectionType(
  OmitType(BaseAdProviderConfigDto, [
    'clientAppKey',
    'appId',
    'dailyLimit',
    'configVersion',
    'sortOrder',
    'isEnabled',
  ] as const),
  AdProviderConfigDefaultOutputFieldsDto,
) {}

export class AdProviderConfigWritableFieldsDto extends OmitType(
  BaseAdProviderConfigDto,
  ['configVersion', 'configMetadata', 'credentialVersionRef'] as const,
) {
  @StringProperty({
    description: 'SSV 密钥选项引用，由服务端映射为密钥版本和安全摘要',
    example: 'env:ES_AD_PANGLE_SSV_SECRET',
    maxLength: 160,
  })
  credentialOptionRef!: string
}

class CreateAdProviderConfigRequiredFieldsDto extends PickType(
  AdProviderConfigWritableFieldsDto,
  [
    'provider',
    'platform',
    'environment',
    'placementKey',
    'targetScope',
    'credentialOptionRef',
  ] as const,
) {}

class CreateAdProviderConfigOptionalFieldsDto extends PartialType(
  PickType(AdProviderConfigWritableFieldsDto, [
    'clientAppKey',
    'appId',
    'dailyLimit',
    'callbackUrl',
    'sortOrder',
    'isEnabled',
  ] as const),
) {}

export class CreateAdProviderConfigDto extends IntersectionType(
  CreateAdProviderConfigRequiredFieldsDto,
  CreateAdProviderConfigOptionalFieldsDto,
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
      'appId',
      'placementKey',
      'targetScope',
      'isEnabled',
    ] as const),
  ),
) {}

export class AdRewardCredentialOptionDto {
  @StringProperty({
    description: '选项展示名',
    example: '穿山甲正式环境 SSV 密钥',
    validation: false,
  })
  label!: string

  @StringProperty({
    description: '选项值',
    example: 'env:ES_AD_PANGLE_SSV_SECRET',
    validation: false,
  })
  value!: string

  @EnumProperty({
    description: '广告 provider（1=穿山甲；2=腾讯优量汇）',
    enum: AdProviderEnum,
    example: AdProviderEnum.PANGLE,
    validation: false,
  })
  provider!: AdProviderEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.SANDBOX,
    validation: false,
  })
  environment!: ProviderEnvironmentEnum

  @StringProperty({
    description: 'SSV 密钥版本引用',
    example: 'env:ES_AD_PANGLE_SSV_SECRET',
    validation: false,
  })
  credentialVersionRef!: string

  @StringProperty({
    description: '密钥指纹',
    example: 'sha256:abcdef12',
    validation: false,
  })
  fingerprint!: string

  @StringProperty({
    description: '选项状态',
    example: 'available',
    validation: false,
  })
  status!: string

  @StringProperty({
    description: '不可选原因',
    example: '环境变量未配置',
    nullable: true,
    validation: false,
  })
  disabledReason!: string | null
}

export class AdRewardVerificationDto {
  @EnumProperty({
    description: '广告 provider（1=穿山甲；2=腾讯优量汇）',
    enum: AdProviderEnum,
    example: AdProviderEnum.PANGLE,
  })
  provider!: AdProviderEnum

  @EnumProperty({
    description: '客户端平台（1=安卓端；2=苹果端；3=鸿蒙端；4=网页端；5=小程序）',
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
    validation: false,
  })
  userId!: number

  @EnumProperty({
    description: '广告状态（1=奖励成功；2=奖励失败；3=已撤销）',
    enum: AdRewardStatusEnum,
    example: AdRewardStatusEnum.SUCCESS,
    validation: false,
  })
  status!: AdRewardStatusEnum

  @StringProperty({
    description: 'provider 奖励唯一 ID',
    example: 'reward-uuid',
    validation: false,
  })
  providerRewardId!: string
}

export class BaseAdRewardRecordDto extends BaseDto {
  @NumberProperty({
    description: '用户 ID',
    example: 1,
  })
  userId!: number

  @NumberProperty({
    description: '广告 provider 配置 ID',
    example: 1,
  })
  adProviderConfigId!: number

  @NumberProperty({
    description: '广告 provider 配置版本快照',
    example: 1,
    validation: false,
  })
  adProviderConfigVersion!: number

  @StringProperty({
    description: 'SSV 密钥版本引用快照',
    example: 'ad:pangle:production:ssv',
    validation: false,
  })
  credentialVersionRef!: string

  @StringProperty({
    description: 'provider 奖励唯一 ID',
    example: 'reward-uuid',
  })
  providerRewardId!: string

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

  @EnumProperty({
    description: '目标类型（1=漫画章节；2=小说章节）',
    enum: CouponRedemptionTargetTypeEnum,
    example: CouponRedemptionTargetTypeEnum.COMIC_CHAPTER,
  })
  targetType!: CouponRedemptionTargetTypeEnum

  @NumberProperty({
    description: '目标 ID',
    example: 1,
  })
  targetId!: number

  @EnumProperty({
    description: '广告状态（1=奖励成功；2=奖励失败；3=已撤销）',
    enum: AdRewardStatusEnum,
    example: AdRewardStatusEnum.SUCCESS,
  })
  status!: AdRewardStatusEnum
}

export class AdminAdRewardRecordDetailDto extends PickType(
  BaseAdRewardRecordDto,
  [
    'id',
    'userId',
    'adProviderConfigVersion',
    'placementKey',
    'targetScope',
    'targetType',
    'targetId',
    'status',
    'createdAt',
    'updatedAt',
  ] as const,
) {
  @ObjectProperty({
    description: '客户端上下文摘要（敏感字段已过滤）',
    example: { deviceModel: 'phone' },
    nullable: true,
    validation: false,
  })
  clientContext!: Record<string, unknown> | null

  @ObjectProperty({
    description: '服务端验证摘要 payload（不含 provider 原始回调）',
    example: { provider: 1, targetScope: 1 },
    nullable: true,
    validation: false,
  })
  verifyPayload!: Record<string, unknown> | null
}

export class QueryAdRewardRecordDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAdRewardRecordDto, [
      'userId',
      'adProviderConfigId',
      'providerRewardId',
      'placementKey',
      'targetScope',
      'targetType',
      'targetId',
      'status',
    ] as const),
  ),
) {
  @EnumProperty({
    description: '广告 provider（1=穿山甲；2=腾讯优量汇）',
    enum: AdProviderEnum,
    example: AdProviderEnum.PANGLE,
    required: false,
  })
  provider?: AdProviderEnum

  @EnumProperty({
    description: '客户端平台（1=安卓端；2=苹果端；3=鸿蒙端；4=网页端；5=小程序）',
    enum: ClientPlatformEnum,
    example: ClientPlatformEnum.ANDROID,
    required: false,
  })
  platform?: ClientPlatformEnum

  @EnumProperty({
    description: '运行环境（1=沙箱；2=正式）',
    enum: ProviderEnvironmentEnum,
    example: ProviderEnvironmentEnum.PRODUCTION,
    required: false,
  })
  environment?: ProviderEnvironmentEnum
}

export class AdRewardRevokeDto extends IdDto {
  @StringProperty({
    description: '撤销原因',
    example: '广告回调对账异常',
    required: false,
    maxLength: 200,
  })
  reason?: string
}

export class AdminAdRewardReconcileItemDto extends BaseAdRewardRecordDto {
  @StringProperty({
    description: '对账状态',
    example: 'entitlement_active',
    validation: false,
  })
  reconcileStatus!: string

  @StringProperty({
    description: '对账说明',
    example: '广告奖励和内容权益均有效',
    validation: false,
  })
  reconcileMessage!: string

  @DateProperty({
    description: '权益过期时间',
    example: '2026-03-04T09:00:00.000Z',
    nullable: true,
    validation: false,
  })
  entitlementExpiresAt!: Date | null
}
