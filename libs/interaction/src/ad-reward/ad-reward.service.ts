import type { adRewardRecord as adRewardRecordTable } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type { AdProviderConfigWritableFieldsDto } from '../ad-reward/dto/ad-reward.dto'
import type { AdRewardCredentialOptionDefinition } from './types/ad-reward.type'
import { createHash } from 'node:crypto'
import process from 'node:process'
import { DrizzleService, toPageResult } from '@db/core'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementStatusEnum,
  ContentEntitlementTargetTypeEnum,
} from '@libs/content/permission/content-entitlement.constant'
import { ContentEntitlementService } from '@libs/content/permission/content-entitlement.service'
import { ContentPermissionService } from '@libs/content/permission/content-permission.service'
import {
  BusinessErrorCode,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  buildDateOnlyRangeInAppTimeZone,
  startOfTodayInAppTimeZone,
} from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { AD_REWARD_PROVIDER_ADAPTERS } from '../ad-reward/ad-reward-provider.adapter'
import {
  AdProviderEnum,
  AdRewardStatusEnum,
  AdTargetScopeEnum,
} from '../ad-reward/ad-reward.constant'
import {
  AdProviderConfigOutputDto,
  AdRewardCredentialOptionDto,
  AdRewardRevokeDto,
  AdRewardVerificationDto,
  CreateAdProviderConfigDto,
  QueryAdProviderConfigDto,
  QueryAdRewardRecordDto,
  UpdateAdProviderConfigDto,
} from '../ad-reward/dto/ad-reward.dto'
import { CouponRedemptionTargetTypeEnum } from '../coupon/coupon.constant'
import { ProviderEnvironmentEnum } from '../payment/payment.constant'

const AD_REWARD_CREDENTIAL_OPTIONS: AdRewardCredentialOptionDefinition[] = [
  {
    value: 'ad:pangle:sandbox:ssv',
    label: '穿山甲沙箱 SSV 密钥',
    provider: AdProviderEnum.PANGLE,
    environment: ProviderEnvironmentEnum.SANDBOX,
    envKey: 'ES_AD_PANGLE_SSV_SECRET',
  },
  {
    value: 'ad:pangle:production:ssv',
    label: '穿山甲正式 SSV 密钥',
    provider: AdProviderEnum.PANGLE,
    environment: ProviderEnvironmentEnum.PRODUCTION,
    envKey: 'ES_AD_PANGLE_SSV_SECRET',
  },
  {
    value: 'ad:tencent-youlianghui:sandbox:ssv',
    label: '腾讯优量汇沙箱 SSV 密钥',
    provider: AdProviderEnum.TENCENT_YOU_LIANG_HUI,
    environment: ProviderEnvironmentEnum.SANDBOX,
    envKey: 'ES_AD_TENCENT_YOU_LIANG_HUI_SSV_SECRET',
  },
  {
    value: 'ad:tencent-youlianghui:production:ssv',
    label: '腾讯优量汇正式 SSV 密钥',
    provider: AdProviderEnum.TENCENT_YOU_LIANG_HUI,
    environment: ProviderEnvironmentEnum.PRODUCTION,
    envKey: 'ES_AD_TENCENT_YOU_LIANG_HUI_SSV_SECRET',
  },
]

@Injectable()
export class AdRewardService {
  private readonly logger = new Logger(AdRewardService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly contentEntitlementService: ContentEntitlementService,
  ) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取广告 provider 配置表定义。
  private get adProviderConfig() {
    return this.drizzle.schema.adProviderConfig
  }

  // 获取广告奖励记录表定义。
  private get adRewardRecord() {
    return this.drizzle.schema.adRewardRecord
  }

  // 获取用户内容权益表定义。
  private get userContentEntitlement() {
    return this.drizzle.schema.userContentEntitlement
  }

  private get adRewardRecordPageSelect() {
    return {
      id: this.adRewardRecord.id,
      userId: this.adRewardRecord.userId,
      adProviderConfigId: this.adRewardRecord.adProviderConfigId,
      adProviderConfigVersion: this.adRewardRecord.adProviderConfigVersion,
      credentialVersionRef: this.adRewardRecord.credentialVersionRef,
      providerRewardId: this.adRewardRecord.providerRewardId,
      placementKey: this.adRewardRecord.placementKey,
      targetScope: this.adRewardRecord.targetScope,
      targetType: this.adRewardRecord.targetType,
      targetId: this.adRewardRecord.targetId,
      status: this.adRewardRecord.status,
      createdAt: this.adRewardRecord.createdAt,
      updatedAt: this.adRewardRecord.updatedAt,
    }
  }

  // 启用或停用广告 provider 配置。
  async updateAdProviderStatus(id: number, isEnabled: boolean) {
    const current = await this.getAdProviderConfigOrThrow(id)
    if (isEnabled) {
      this.assertProviderConfigCanEnable(current)
    }
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adProviderConfig)
          .set({
            isEnabled,
            configVersion: sql`${this.adProviderConfig.configVersion} + 1`,
          })
          .where(eq(this.adProviderConfig.id, id)),
      {
        notFound: '广告 provider 配置不存在',
        duplicate: '广告 provider 启用配置已存在',
      },
    )
    return true
  }

  // 更新广告 provider 配置并推进配置版本。
  async updateAdProviderConfig(dto: UpdateAdProviderConfigDto) {
    const { id, ...data } = dto
    const current = await this.getAdProviderConfigOrThrow(id)
    const providerChanged =
      data.provider !== undefined && data.provider !== current.provider
    const environmentChanged =
      data.environment !== undefined && data.environment !== current.environment
    if (
      (providerChanged || environmentChanged) &&
      data.credentialOptionRef === undefined
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '修改广告 provider 或环境时必须重新选择匹配的 SSV 密钥选项',
      )
    }
    const writeData = this.buildAdProviderConfigUpdateData(data, {
      provider: data.provider ?? current.provider,
      environment: data.environment ?? current.environment,
    })
    const merged = { ...current, ...writeData }
    if (merged.isEnabled) {
      this.assertProviderConfigCanEnable(merged)
    }
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adProviderConfig)
          .set({
            ...writeData,
            configVersion: sql`${this.adProviderConfig.configVersion} + 1`,
          })
          .where(eq(this.adProviderConfig.id, id)),
      {
        notFound: '广告 provider 配置不存在',
        duplicate: '广告 provider 启用配置已存在',
      },
    )
    return true
  }

  // 标准化可选业务键，空值统一落为空字符串。
  private normalizeKey(input?: string | null) {
    return input?.trim() ?? ''
  }

  // 创建广告 provider 配置。
  async createAdProviderConfig(dto: CreateAdProviderConfigDto) {
    const data = this.buildAdProviderConfigCreateData(dto)
    if (data.isEnabled) {
      this.assertProviderConfigCanEnable(data)
    }
    await this.drizzle.withErrorHandling(
      () => this.db.insert(this.adProviderConfig).values(data),
      { duplicate: '广告 provider 启用配置已存在' },
    )
    return true
  }

  // 查询可供 admin 选择的广告验签密钥选项；只返回 ref、标签和指纹状态。
  async getAdRewardCredentialOptions() {
    return AD_REWARD_CREDENTIAL_OPTIONS.map((option) =>
      this.toCredentialOptionDto(option),
    )
  }

  // 分页查询广告 provider 配置。
  async getAdProviderConfigPage(dto: QueryAdProviderConfigDto) {
    const conditions: SQL[] = []
    if (dto.provider !== undefined) {
      conditions.push(eq(this.adProviderConfig.provider, dto.provider))
    }
    if (dto.platform !== undefined) {
      conditions.push(eq(this.adProviderConfig.platform, dto.platform))
    }
    if (dto.environment !== undefined) {
      conditions.push(eq(this.adProviderConfig.environment, dto.environment))
    }
    if (dto.clientAppKey !== undefined) {
      conditions.push(
        eq(
          this.adProviderConfig.clientAppKey,
          this.normalizeKey(dto.clientAppKey),
        ),
      )
    }
    if (dto.placementKey !== undefined) {
      conditions.push(eq(this.adProviderConfig.placementKey, dto.placementKey))
    }
    if (dto.appId !== undefined) {
      conditions.push(
        eq(this.adProviderConfig.appId, this.normalizeKey(dto.appId)),
      )
    }
    if (dto.targetScope !== undefined) {
      conditions.push(eq(this.adProviderConfig.targetScope, dto.targetScope))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.adProviderConfig.isEnabled, dto.isEnabled))
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      dto.startDate,
      dto.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(this.adProviderConfig.createdAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.adProviderConfig.createdAt, dateRange.lt))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
      { table: this.adProviderConfig },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.adProviderConfig)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.adProviderConfig, where),
    ])

    return toPageResult(
      list.map((row) => this.sanitizeAdProviderConfigForAdmin(row)),
      total,
      page,
    )
  }

  // 分页查询广告奖励记录，运营常用维度优先使用枚举/选择项，避免依赖内部 payload。
  async getAdRewardRecordPage(dto: QueryAdRewardRecordDto) {
    const conditions = this.buildAdRewardRecordConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? JSON.stringify({ createdAt: 'desc', id: 'desc' }),
      { table: this.adRewardRecord },
    )
    const [list, total] = await Promise.all([
      this.db
        .select(this.adRewardRecordPageSelect)
        .from(this.adRewardRecord)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.adRewardRecord, where),
    ])

    return toPageResult(list, total, page)
  }

  // 查询广告奖励详情，供运营排查单条奖励和权益状态。
  async getAdRewardRecordDetail(id: number) {
    const record = await this.db.query.adRewardRecord.findFirst({
      where: { id },
    })
    if (!record) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '广告奖励记录不存在',
      )
    }
    return this.sanitizeAdRewardRecordDetail(record)
  }

  // 撤销广告奖励和它精确来源写入的内容权益。
  async revokeAdRewardRecord(dto: AdRewardRevokeDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const record = await tx.query.adRewardRecord.findFirst({
        where: { id: dto.id },
      })
      if (!record) {
        throw new BusinessException(
          BusinessErrorCode.RESOURCE_NOT_FOUND,
          '广告奖励记录不存在',
        )
      }
      if (record.status !== AdRewardStatusEnum.REVOKED) {
        await tx
          .update(this.adRewardRecord)
          .set({
            status: AdRewardStatusEnum.REVOKED,
            verifyPayload: {
              ...(this.asRecord(record.verifyPayload) ?? {}),
              revokeReason: dto.reason?.trim() || null,
              revokedAt: new Date().toISOString(),
            },
          })
          .where(eq(this.adRewardRecord.id, dto.id))
      }

      await this.contentEntitlementService.revokeEntitlementBySource(tx, {
        grantSource: ContentEntitlementGrantSourceEnum.AD,
        sourceId: record.id,
      })
      return true
    })
  }

  // 分页查询广告奖励与权益对账视图。
  async getAdRewardReconcilePage(dto: QueryAdRewardRecordDto) {
    const conditions = this.buildAdRewardRecordConditions(dto)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const rows = await this.db
      .select({
        ...this.adRewardRecordPageSelect,
        entitlementStatus: this.userContentEntitlement.status,
        entitlementExpiresAt: this.userContentEntitlement.expiresAt,
      })
      .from(this.adRewardRecord)
      .leftJoin(
        this.userContentEntitlement,
        and(
          eq(
            this.userContentEntitlement.grantSource,
            ContentEntitlementGrantSourceEnum.AD,
          ),
          eq(this.userContentEntitlement.sourceId, this.adRewardRecord.id),
          eq(this.userContentEntitlement.userId, this.adRewardRecord.userId),
          eq(
            this.userContentEntitlement.targetType,
            this.adRewardRecord.targetType,
          ),
          eq(
            this.userContentEntitlement.targetId,
            this.adRewardRecord.targetId,
          ),
        ),
      )
      .where(where)
      .orderBy(
        desc(this.adRewardRecord.createdAt),
        desc(this.adRewardRecord.id),
      )
      .limit(page.limit)
      .offset(page.offset)
    const total = await this.db.$count(this.adRewardRecord, where)

    return toPageResult(
      rows.map(({ entitlementStatus, entitlementExpiresAt, ...record }) => ({
        ...record,
        ...this.resolveAdRewardReconcileStatus(
          record.status,
          entitlementStatus,
          entitlementExpiresAt,
        ),
      })),
      total,
      page,
    )
  }

  // 验证广告奖励回调并写入奖励权益事实。
  async verifyAdReward(userId: number, dto: AdRewardVerificationDto) {
    const config = await this.resolveAdProviderConfig(dto)
    const adapter = this.getAdRewardAdapter(dto.provider)
    if (!adapter.verifyRewardCallback({ userId, config, payload: dto })) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告奖励验证失败',
      )
    }
    const rewardPayload = adapter.parseRewardPayload({
      userId,
      config,
      payload: dto,
    })
    const targetType = await this.assertAdTargetAllowed(dto)

    return this.drizzle.withTransaction(async (tx) => {
      const existing = await tx.query.adRewardRecord.findFirst({
        where: {
          adProviderConfigId: config.id,
          providerRewardId: rewardPayload.providerRewardId,
        },
      })
      if (existing) {
        this.assertDuplicateRewardMatches(existing, {
          userId,
          targetScope: dto.targetScope,
          targetType,
          targetId: dto.targetId,
        })
        return existing
      }

      if (config.dailyLimit > 0) {
        const [countRow] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(this.adRewardRecord)
          .where(
            and(
              eq(this.adRewardRecord.userId, userId),
              eq(this.adRewardRecord.adProviderConfigId, config.id),
              eq(this.adRewardRecord.status, AdRewardStatusEnum.SUCCESS),
              gte(this.adRewardRecord.createdAt, startOfTodayInAppTimeZone()),
            ),
          )
        if (Number(countRow?.count ?? 0) >= config.dailyLimit) {
          throw new BusinessException(
            BusinessErrorCode.QUOTA_NOT_ENOUGH,
            '广告奖励次数已达上限',
          )
        }
      }

      const [record] = await tx
        .insert(this.adRewardRecord)
        .values({
          userId,
          adProviderConfigId: config.id,
          adProviderConfigVersion: config.configVersion,
          credentialVersionRef: config.credentialVersionRef,
          providerRewardId: rewardPayload.providerRewardId,
          placementKey: rewardPayload.placementKey,
          targetScope: dto.targetScope,
          targetType,
          targetId: dto.targetId,
          status: AdRewardStatusEnum.SUCCESS,
          clientContext: dto.clientContext,
          rawNotifyPayload: dto.verifyPayload,
          verifyPayload: {
            provider: dto.provider,
            platform: dto.platform,
            environment: dto.environment,
            clientAppKey: this.normalizeKey(dto.clientAppKey),
            appId: this.normalizeKey(dto.appId),
            targetScope: dto.targetScope,
          },
        })
        .onConflictDoNothing()
        .returning()
      if (!record) {
        const duplicated = await tx.query.adRewardRecord.findFirst({
          where: {
            adProviderConfigId: config.id,
            providerRewardId: rewardPayload.providerRewardId,
          },
        })
        if (duplicated) {
          this.assertDuplicateRewardMatches(duplicated, {
            userId,
            targetScope: dto.targetScope,
            targetType,
            targetId: dto.targetId,
          })
          return duplicated
        }
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '广告奖励写入失败',
        )
      }

      await this.contentEntitlementService.grantEntitlement(tx, {
        userId,
        targetType,
        targetId: dto.targetId,
        grantSource: ContentEntitlementGrantSourceEnum.AD,
        sourceId: record.id,
        sourceKey: rewardPayload.providerRewardId,
        expiresAt: this.addDays(new Date(), 1),
        grantSnapshot: {
          adProviderConfigId: config.id,
          adProviderConfigVersion: config.configVersion,
          credentialVersionRef: config.credentialVersionRef,
          placementKey: rewardPayload.placementKey,
          targetScope: dto.targetScope,
        },
      })

      this.logger.log(
        `ad_reward_success userId=${userId} adProviderConfigId=${config.id} adProviderConfigVersion=${config.configVersion} providerRewardId=${rewardPayload.providerRewardId}`,
      )

      return record
    })
  }

  // 基于输入时间增加指定天数。
  private addDays(input: Date, days: number) {
    const output = new Date(input)
    output.setDate(output.getDate() + days)
    return output
  }

  // 将券和广告目标类型映射为内容权益目标类型。
  private resolveContentEntitlementTargetType(
    targetType: CouponRedemptionTargetTypeEnum,
  ) {
    if (targetType === CouponRedemptionTargetTypeEnum.COMIC_CHAPTER) {
      return ContentEntitlementTargetTypeEnum.COMIC_CHAPTER
    }
    if (targetType === CouponRedemptionTargetTypeEnum.NOVEL_CHAPTER) {
      return ContentEntitlementTargetTypeEnum.NOVEL_CHAPTER
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '目标类型不支持内容权益',
    )
  }

  // 校验广告奖励目标当前需要广告解锁，并返回章节真实权益目标类型。
  private async assertAdTargetAllowed(dto: AdRewardVerificationDto) {
    if (dto.targetScope !== AdTargetScopeEnum.LOW_PRICE_CHAPTER) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '目标范围暂未支持广告解锁',
      )
    }
    const permission =
      await this.contentPermissionService.resolveChapterPermission(dto.targetId)
    const expectedTargetType =
      this.contentPermissionService.resolveChapterEntitlementTargetType(
        permission.workType,
      )
    if (!expectedTargetType) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '目标类型不支持内容权益',
      )
    }
    if (
      expectedTargetType !==
      this.resolveContentEntitlementTargetType(dto.targetType)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告奖励目标类型与章节类型不一致',
      )
    }
    if (permission.viewRule === WorkViewPermissionEnum.VIP) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告解锁不能用于 VIP 内容',
      )
    }
    if (
      permission.viewRule === WorkViewPermissionEnum.PURCHASE &&
      (permission.purchasePricing?.originalPrice ?? 0) > 100
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告解锁不能用于高价章节',
      )
    }
    return expectedTargetType
  }

  // 获取指定广告 provider 的奖励适配器。
  private getAdRewardAdapter(provider: number) {
    const adapter = AD_REWARD_PROVIDER_ADAPTERS.find(
      (candidate) => candidate.provider === provider,
    )
    if (!adapter) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '不支持的广告 provider',
      )
    }
    return adapter
  }

  // 按广告奖励请求解析可用的广告 provider 配置。
  private async resolveAdProviderConfig(dto: AdRewardVerificationDto) {
    const candidates = await this.db
      .select()
      .from(this.adProviderConfig)
      .where(
        and(
          eq(this.adProviderConfig.provider, dto.provider),
          eq(this.adProviderConfig.platform, dto.platform),
          eq(this.adProviderConfig.environment, dto.environment),
          eq(
            this.adProviderConfig.clientAppKey,
            this.normalizeKey(dto.clientAppKey),
          ),
          eq(this.adProviderConfig.appId, this.normalizeKey(dto.appId)),
          eq(this.adProviderConfig.placementKey, dto.placementKey),
          eq(this.adProviderConfig.targetScope, dto.targetScope),
          eq(this.adProviderConfig.isEnabled, true),
        ),
      )
      .orderBy(
        asc(this.adProviderConfig.sortOrder),
        asc(this.adProviderConfig.id),
      )
      .limit(2)

    if (candidates.length === 0) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告 provider 配置缺失或未启用',
      )
    }
    if (candidates.length > 1) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '广告 provider 配置冲突',
      )
    }
    return candidates[0]
  }

  private buildAdRewardRecordConditions(dto: QueryAdRewardRecordDto) {
    const conditions: SQL[] = []
    if (dto.userId !== undefined) {
      conditions.push(eq(this.adRewardRecord.userId, dto.userId))
    }
    if (dto.adProviderConfigId !== undefined) {
      conditions.push(
        eq(this.adRewardRecord.adProviderConfigId, dto.adProviderConfigId),
      )
    }
    if (dto.providerRewardId !== undefined) {
      conditions.push(
        eq(this.adRewardRecord.providerRewardId, dto.providerRewardId),
      )
    }
    if (dto.placementKey !== undefined) {
      conditions.push(eq(this.adRewardRecord.placementKey, dto.placementKey))
    }
    if (dto.targetScope !== undefined) {
      conditions.push(eq(this.adRewardRecord.targetScope, dto.targetScope))
    }
    if (dto.targetType !== undefined) {
      conditions.push(eq(this.adRewardRecord.targetType, dto.targetType))
    }
    if (dto.targetId !== undefined) {
      conditions.push(eq(this.adRewardRecord.targetId, dto.targetId))
    }
    if (dto.status !== undefined) {
      conditions.push(eq(this.adRewardRecord.status, dto.status))
    }
    if (
      dto.provider !== undefined ||
      dto.platform !== undefined ||
      dto.environment !== undefined
    ) {
      const configFilters: SQL[] = []
      if (dto.provider !== undefined) {
        configFilters.push(eq(this.adProviderConfig.provider, dto.provider))
      }
      if (dto.platform !== undefined) {
        configFilters.push(eq(this.adProviderConfig.platform, dto.platform))
      }
      if (dto.environment !== undefined) {
        configFilters.push(
          eq(this.adProviderConfig.environment, dto.environment),
        )
      }
      conditions.push(
        sql`${this.adRewardRecord.adProviderConfigId} in (
          select ${this.adProviderConfig.id}
          from ${this.adProviderConfig}
          where ${and(...configFilters)}
        )`,
      )
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      dto.startDate,
      dto.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(gte(this.adRewardRecord.createdAt, dateRange.gte))
    }
    if (dateRange?.lt) {
      conditions.push(lt(this.adRewardRecord.createdAt, dateRange.lt))
    }
    return conditions
  }

  private assertDuplicateRewardMatches(
    existing: {
      userId: number
      targetScope: number
      targetType: number
      targetId: number
    },
    expected: {
      userId: number
      targetScope: AdTargetScopeEnum
      targetType: ContentEntitlementTargetTypeEnum
      targetId: number
    },
  ) {
    if (
      existing.userId !== expected.userId ||
      existing.targetScope !== expected.targetScope ||
      existing.targetType !== expected.targetType ||
      existing.targetId !== expected.targetId
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '广告奖励幂等键与业务目标不一致',
      )
    }
  }

  private resolveAdRewardReconcileStatus(
    rewardStatus: AdRewardStatusEnum,
    entitlementStatus: number | null | undefined,
    entitlementExpiresAt: Date | null,
    now = new Date(),
  ) {
    const entitlementIsActive =
      entitlementStatus === ContentEntitlementStatusEnum.ACTIVE
    const entitlementIsExpired = this.isEntitlementExpired(
      entitlementExpiresAt,
      now,
    )
    if (rewardStatus === AdRewardStatusEnum.REVOKED) {
      if (entitlementIsActive && entitlementIsExpired) {
        return {
          reconcileStatus: 'revoked_reward_expired_entitlement',
          reconcileMessage: '广告奖励已撤销，但对应权益仍处于有效状态且已过期',
          entitlementExpiresAt,
        }
      }
      if (entitlementIsActive) {
        return {
          reconcileStatus: 'revoked_reward_active_entitlement',
          reconcileMessage: '广告奖励已撤销，但对应内容权益仍有效',
          entitlementExpiresAt,
        }
      }
      return {
        reconcileStatus: 'reward_revoked',
        reconcileMessage: '广告奖励已撤销',
        entitlementExpiresAt,
      }
    }
    if (rewardStatus === AdRewardStatusEnum.FAILED) {
      if (entitlementIsActive) {
        return {
          reconcileStatus: 'failed_reward_active_entitlement',
          reconcileMessage: '广告奖励失败，但对应内容权益仍有效',
          entitlementExpiresAt,
        }
      }
      return {
        reconcileStatus: 'reward_failed',
        reconcileMessage: '广告奖励失败，不应发放内容权益',
        entitlementExpiresAt,
      }
    }
    if (entitlementStatus === undefined || entitlementStatus === null) {
      return {
        reconcileStatus: 'entitlement_missing',
        reconcileMessage: '广告奖励成功但未找到对应内容权益',
        entitlementExpiresAt,
      }
    }
    if (entitlementIsActive && entitlementIsExpired) {
      return {
        reconcileStatus: 'entitlement_expired',
        reconcileMessage: '内容权益仍为有效状态但已超过过期时间',
        entitlementExpiresAt,
      }
    }
    if (entitlementIsActive) {
      return {
        reconcileStatus: 'entitlement_active',
        reconcileMessage: '广告奖励和内容权益均有效',
        entitlementExpiresAt,
      }
    }
    return {
      reconcileStatus: 'entitlement_inactive',
      reconcileMessage: '广告奖励未撤销但内容权益不是有效状态',
      entitlementExpiresAt,
    }
  }

  private isEntitlementExpired(expiresAt: Date | null, now: Date) {
    return expiresAt !== null && expiresAt.getTime() <= now.getTime()
  }

  private asRecord(input: unknown) {
    return input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null
  }

  private sanitizeAdRewardRecordDetail(
    record: typeof adRewardRecordTable.$inferSelect,
  ) {
    const verifyPayload = this.asRecord(record.verifyPayload)
    return {
      id: record.id,
      userId: record.userId,
      adProviderConfigVersion: record.adProviderConfigVersion,
      placementKey: record.placementKey,
      targetScope: record.targetScope,
      targetType: record.targetType,
      targetId: record.targetId,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      clientContext: this.summarizePayload(record.clientContext),
      verifyPayload: verifyPayload
        ? {
            provider: verifyPayload.provider,
            platform: verifyPayload.platform,
            environment: verifyPayload.environment,
            clientAppKey: verifyPayload.clientAppKey,
            appId: verifyPayload.appId,
            targetScope: verifyPayload.targetScope,
            revokedAt: verifyPayload.revokedAt,
            revokeReason: verifyPayload.revokeReason,
          }
        : null,
    }
  }

  private summarizePayload(input: unknown) {
    const payload = this.asRecord(input)
    if (!payload) {
      return null
    }
    return Object.fromEntries(
      Object.entries(payload)
        .filter(([key]) => !/secret|token|sign|payload|raw/i.test(key))
        .map(([key, value]) => [
          key,
          typeof value === 'string' && value.length > 64
            ? `${value.slice(0, 16)}...${value.slice(-8)}`
            : value,
        ]),
    )
  }

  private async getAdProviderConfigOrThrow(id: number) {
    const row = await this.db.query.adProviderConfig.findFirst({
      where: { id },
    })
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告 provider 配置不存在',
      )
    }
    return row
  }

  private buildAdProviderConfigCreateData(dto: CreateAdProviderConfigDto) {
    const credential = this.resolveCredentialOptionForConfig(
      dto.credentialOptionRef,
      {
        provider: dto.provider,
        environment: dto.environment,
      },
    )
    return {
      provider: dto.provider,
      platform: dto.platform,
      environment: dto.environment,
      clientAppKey: this.normalizeKey(dto.clientAppKey),
      appId: this.normalizeKey(dto.appId),
      placementKey: dto.placementKey,
      targetScope: dto.targetScope,
      dailyLimit: dto.dailyLimit ?? 0,
      configVersion: 1,
      credentialVersionRef: credential.credentialVersionRef,
      callbackUrl: dto.callbackUrl ?? null,
      configMetadata: credential.configMetadata,
      sortOrder: dto.sortOrder ?? 0,
      isEnabled: dto.isEnabled ?? true,
    }
  }

  private buildAdProviderConfigUpdateData(
    dto: Partial<AdProviderConfigWritableFieldsDto>,
    expectedConfig: {
      provider: AdProviderEnum
      environment: ProviderEnvironmentEnum
    },
  ) {
    const credential =
      dto.credentialOptionRef === undefined
        ? undefined
        : this.resolveCredentialOptionForConfig(
            dto.credentialOptionRef,
            expectedConfig,
          )
    return {
      provider: dto.provider,
      platform: dto.platform,
      environment: dto.environment,
      clientAppKey:
        dto.clientAppKey === undefined
          ? undefined
          : this.normalizeKey(dto.clientAppKey),
      appId: dto.appId === undefined ? undefined : this.normalizeKey(dto.appId),
      placementKey: dto.placementKey,
      targetScope: dto.targetScope,
      dailyLimit: dto.dailyLimit,
      credentialVersionRef: credential?.credentialVersionRef,
      callbackUrl: dto.callbackUrl === undefined ? undefined : dto.callbackUrl,
      configMetadata: credential?.configMetadata,
      sortOrder: dto.sortOrder,
      isEnabled: dto.isEnabled,
    }
  }

  private resolveCredentialOptionForConfig(
    ref: string,
    expectedConfig: {
      provider: AdProviderEnum
      environment: ProviderEnvironmentEnum
    },
  ) {
    const credential = this.resolveCredentialOption(ref)
    if (
      credential.provider !== expectedConfig.provider ||
      credential.environment !== expectedConfig.environment
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告验签密钥选项与 provider 或环境不匹配',
      )
    }
    return credential
  }

  private resolveCredentialOption(ref: string) {
    const option = AD_REWARD_CREDENTIAL_OPTIONS.find(
      (candidate) => candidate.value === ref,
    )
    if (!option) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告验签密钥选项不存在',
      )
    }
    const secret = process.env[option.envKey]
    const fingerprint = secret
      ? `sha256:${createHash('sha256').update(secret).digest('hex').slice(0, 12)}`
      : ''
    return {
      provider: option.provider,
      environment: option.environment,
      credentialVersionRef: option.value,
      configMetadata: {
        credentialOptionRef: option.value,
        keyFingerprint: fingerprint,
        verifySecretEnvKey: option.envKey,
      },
    }
  }

  private sanitizeAdProviderConfigForAdmin(
    row: typeof this.adProviderConfig.$inferSelect,
  ): AdProviderConfigOutputDto {
    const metadata = this.asRecord(row.configMetadata)
    const safeMetadata = metadata
      ? (() => {
          const { verifySecretEnvKey, ...rest } = metadata
          void verifySecretEnvKey
          return rest
        })()
      : null
    return {
      ...row,
      clientAppKey: row.clientAppKey ?? '',
      appId: row.appId ?? '',
      dailyLimit: row.dailyLimit ?? 0,
      configVersion: row.configVersion ?? 1,
      callbackUrl: row.callbackUrl ?? null,
      configMetadata: safeMetadata,
      sortOrder: row.sortOrder ?? 0,
      isEnabled: row.isEnabled ?? true,
    }
  }

  private toCredentialOptionDto(
    option: AdRewardCredentialOptionDefinition,
  ): AdRewardCredentialOptionDto {
    const secret = process.env[option.envKey]
    return {
      label: option.label,
      value: option.value,
      provider: option.provider,
      environment: option.environment,
      credentialVersionRef: option.value,
      fingerprint: secret
        ? `sha256:${createHash('sha256').update(secret).digest('hex').slice(0, 12)}`
        : '',
      status: secret ? 'available' : 'disabled',
      disabledReason: secret ? null : '密钥未配置或不可用',
    }
  }

  private assertProviderConfigCanEnable(input: {
    provider?: AdProviderEnum
    platform?: number
    environment?: ProviderEnvironmentEnum
    placementKey?: string
    targetScope?: AdTargetScopeEnum
    credentialVersionRef?: string
    configMetadata?: unknown
  }) {
    if (
      input.provider === undefined ||
      input.platform === undefined ||
      input.environment === undefined ||
      !input.placementKey ||
      input.targetScope === undefined ||
      !input.credentialVersionRef
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告 provider 启用配置不完整',
      )
    }
    if (input.targetScope !== AdTargetScopeEnum.LOW_PRICE_CHAPTER) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '目标范围暂未支持启用广告奖励',
      )
    }
    const metadata = input.configMetadata
    const verifySecretEnvKey =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>).verifySecretEnvKey
        : undefined
    if (
      typeof verifySecretEnvKey !== 'string' ||
      verifySecretEnvKey.length === 0 ||
      !process.env[verifySecretEnvKey]
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '广告验签密钥未配置或不可用',
      )
    }
  }
}
