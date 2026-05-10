import type { SQL } from 'drizzle-orm'
import { DrizzleService } from '@db/core'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementTargetTypeEnum,
} from '@libs/content/permission/content-entitlement.constant'
import { ContentEntitlementService } from '@libs/content/permission/content-entitlement.service'
import { ContentPermissionService } from '@libs/content/permission/content-permission.service'
import {
  BusinessErrorCode,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { startOfTodayInAppTimeZone } from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import { and, asc, eq, gte, sql } from 'drizzle-orm'
import { AD_REWARD_PROVIDER_ADAPTERS } from '../ad-reward/ad-reward-provider.adapter'
import { AdRewardStatusEnum } from '../ad-reward/ad-reward.constant'
import {
  AdRewardVerificationDto,
  CreateAdProviderConfigDto,
  QueryAdProviderConfigDto,
  UpdateAdProviderConfigDto,
} from '../ad-reward/dto/ad-reward.dto'
import { CouponRedemptionTargetTypeEnum } from '../coupon/coupon.constant'

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

  // 启用或停用广告 provider 配置。
  async updateAdProviderStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adProviderConfig)
          .set({ isEnabled })
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
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.adProviderConfig)
          .set({
            ...data,
            clientAppKey:
              data.clientAppKey === undefined
                ? undefined
                : this.normalizeKey(data.clientAppKey),
            appId:
              data.appId === undefined
                ? undefined
                : this.normalizeKey(data.appId),
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
    await this.drizzle.withErrorHandling(
      () =>
        this.db.insert(this.adProviderConfig).values({
          ...dto,
          clientAppKey: this.normalizeKey(dto.clientAppKey),
          appId: this.normalizeKey(dto.appId),
        }),
      { duplicate: '广告 provider 启用配置已存在' },
    )
    return true
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
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.adProviderConfig.isEnabled, dto.isEnabled))
    }
    return this.drizzle.ext.findPagination(this.adProviderConfig, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ sortOrder: 'asc', id: 'asc' }),
    })
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
    await this.assertAdTargetAllowed(dto)

    return this.drizzle.withTransaction(async (tx) => {
      const existing = await tx.query.adRewardRecord.findFirst({
        where: {
          adProviderConfigId: config.id,
          providerRewardId: rewardPayload.providerRewardId,
        },
      })
      if (existing) {
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
          targetType: this.resolveContentEntitlementTargetType(dto.targetType),
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
          return duplicated
        }
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '广告奖励写入失败',
        )
      }

      await this.contentEntitlementService.grantEntitlement(tx, {
        userId,
        targetType: this.resolveContentEntitlementTargetType(dto.targetType),
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

  // 校验广告奖励目标当前需要广告解锁。
  private async assertAdTargetAllowed(dto: AdRewardVerificationDto) {
    const permission =
      await this.contentPermissionService.resolveChapterPermission(dto.targetId)
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
}
