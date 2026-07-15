import type { DbTransaction } from '@db/core'
import type {
  AdRewardContentAccessProjection,
  AdRewardContentPort,
  AdRewardEntitlementReference,
  GrantAdRewardTemporaryAccessInput,
  ResolveAdRewardContentTargetInput,
} from '@libs/interaction/ad-reward/types/ad-reward-content-port.type'
import { DrizzleService } from '@db/core'
import { AdTargetScopeEnum } from '@libs/interaction/ad-reward/ad-reward.constant'
import {
  BusinessErrorCode,
  WorkViewPermissionEnum,
} from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray } from 'drizzle-orm'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementStatusEnum,
  ContentEntitlementTargetTypeEnum,
} from './content-entitlement.constant'
import { ContentEntitlementService } from './content-entitlement.service'
import { ContentPermissionService } from './content-permission.service'

/**
 * 内容域对广告奖励端口的具体实现。
 * 该适配器保留内容权限、权益闭集和表访问的 owner，供 interaction 在同一事务中使用。
 */
@Injectable()
export class ContentAdRewardPortAdapter implements AdRewardContentPort {
  // 初始化内容权限和权益 owner。
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly contentPermissionService: ContentPermissionService,
    private readonly contentEntitlementService: ContentEntitlementService,
  ) {}

  // 读取用户内容权益表定义，仅在内容域内执行权益投影查询。
  private get userContentEntitlement() {
    return this.drizzle.schema.userContentEntitlement
  }

  // 校验广告奖励只可用于受支持的低价章节，并返回内容域确认的权益目标类型。
  async resolveTarget(input: ResolveAdRewardContentTargetInput) {
    if (input.targetScope !== AdTargetScopeEnum.LOW_PRICE_CHAPTER) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '目标范围暂未支持广告解锁',
      )
    }
    const permission =
      await this.contentPermissionService.resolveChapterPermission(
        input.targetId,
      )
    const targetType =
      this.contentPermissionService.resolveChapterEntitlementTargetType(
        permission.workType,
      )
    if (!targetType) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '目标类型不支持内容权益',
      )
    }
    const requestedTargetType = this.toContentTargetType(
      input.requestedTargetType,
    )
    if (targetType !== requestedTargetType) {
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
    return { targetType }
  }

  // 在 interaction 已开启的事务内写入一天有效的广告临时访问权。
  async grantTemporaryAccess(
    tx: DbTransaction,
    input: GrantAdRewardTemporaryAccessInput,
  ) {
    await this.contentEntitlementService.grantEntitlement(tx, {
      userId: input.userId,
      targetType: this.toContentTargetType(input.targetType),
      targetId: input.targetId,
      grantSource: ContentEntitlementGrantSourceEnum.AD,
      sourceId: input.sourceId,
      sourceKey: input.sourceKey,
      expiresAt: input.expiresAt,
      grantSnapshot: input.grantSnapshot,
    })
  }

  // 在 interaction 已开启的事务内按广告奖励记录精确撤销仍有效的临时访问权。
  async revokeTemporaryAccessByReward(
    tx: DbTransaction,
    rewardRecordId: number,
  ) {
    return this.contentEntitlementService.revokeEntitlementBySource(tx, {
      grantSource: ContentEntitlementGrantSourceEnum.AD,
      sourceId: rewardRecordId,
    })
  }

  // 按当前页广告记录批量读取对账投影，仍以广告来源、用户和目标四元组精确匹配。
  async getAccessProjections(records: AdRewardEntitlementReference[]) {
    if (records.length === 0) {
      return new Map<number, AdRewardContentAccessProjection>()
    }
    const recordsById = new Map(records.map((record) => [record.id, record]))
    const rows = await this.drizzle.db
      .select({
        sourceId: this.userContentEntitlement.sourceId,
        userId: this.userContentEntitlement.userId,
        targetType: this.userContentEntitlement.targetType,
        targetId: this.userContentEntitlement.targetId,
        status: this.userContentEntitlement.status,
        expiresAt: this.userContentEntitlement.expiresAt,
      })
      .from(this.userContentEntitlement)
      .where(
        and(
          eq(
            this.userContentEntitlement.grantSource,
            ContentEntitlementGrantSourceEnum.AD,
          ),
          inArray(
            this.userContentEntitlement.sourceId,
            records.map((record) => record.id),
          ),
        ),
      )
    const projections = new Map<number, AdRewardContentAccessProjection>()
    for (const row of rows) {
      if (row.sourceId === null) {
        continue
      }
      const record = recordsById.get(row.sourceId)
      if (
        !record ||
        row.userId !== record.userId ||
        row.targetType !== record.targetType ||
        row.targetId !== record.targetId
      ) {
        continue
      }
      projections.set(record.id, {
        isActive: row.status === ContentEntitlementStatusEnum.ACTIVE,
        expiresAt: row.expiresAt,
      })
    }
    return projections
  }

  // 将端口边界中的数字目标收窄为内容权益唯一允许的闭集值。
  private toContentTargetType(targetType: number) {
    if (targetType === ContentEntitlementTargetTypeEnum.COMIC_CHAPTER) {
      return targetType
    }
    if (targetType === ContentEntitlementTargetTypeEnum.NOVEL_CHAPTER) {
      return targetType
    }
    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '目标类型不支持内容权益',
    )
  }
}
