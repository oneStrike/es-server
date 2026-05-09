import type {
  ContentEntitlementTarget,
  ContentEntitlementTx,
  GrantContentEntitlementInput,
  GrantPurchaseEntitlementInput,
} from './content-entitlement.type'
import { DrizzleService } from '@db/core'
import { Injectable } from '@nestjs/common'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementStatusEnum,
} from './content-entitlement.constant'

@Injectable()
export class ContentEntitlementService {
  // 初始化内容权益服务依赖。
  constructor(private readonly drizzle: DrizzleService) {}

  // 读取默认 db。
  private get db() {
    return this.drizzle.db
  }

  // 读取用户内容权益表。
  private get userContentEntitlement() {
    return this.drizzle.schema.userContentEntitlement
  }

  // 判断用户是否拥有任意有效内容权益。
  async hasActiveEntitlement(
    target: ContentEntitlementTarget,
    now = new Date(),
  ) {
    const [entitlement] = await this.db
      .select({ id: this.userContentEntitlement.id })
      .from(this.userContentEntitlement)
      .where(
        and(
          eq(this.userContentEntitlement.userId, target.userId),
          eq(this.userContentEntitlement.targetType, target.targetType),
          eq(this.userContentEntitlement.targetId, target.targetId),
          eq(
            this.userContentEntitlement.status,
            ContentEntitlementStatusEnum.ACTIVE,
          ),
          or(
            isNull(this.userContentEntitlement.expiresAt),
            gt(this.userContentEntitlement.expiresAt, now),
          ),
        ),
      )
      .limit(1)

    return !!entitlement
  }

  // 判断用户是否拥有有效购买权益，购买计数和 purchased 字段必须与该条件保持一致。
  async hasPurchaseEntitlement(
    target: ContentEntitlementTarget,
    now = new Date(),
  ) {
    const [entitlement] = await this.db
      .select({ id: this.userContentEntitlement.id })
      .from(this.userContentEntitlement)
      .where(
        and(
          eq(this.userContentEntitlement.userId, target.userId),
          eq(this.userContentEntitlement.targetType, target.targetType),
          eq(this.userContentEntitlement.targetId, target.targetId),
          eq(
            this.userContentEntitlement.grantSource,
            ContentEntitlementGrantSourceEnum.PURCHASE,
          ),
          eq(
            this.userContentEntitlement.status,
            ContentEntitlementStatusEnum.ACTIVE,
          ),
          or(
            isNull(this.userContentEntitlement.expiresAt),
            gt(this.userContentEntitlement.expiresAt, now),
          ),
        ),
      )
      .limit(1)

    return !!entitlement
  }

  // 在外部事务内写入内容权益，调用方负责保证来源业务事实已成功落库。
  async grantEntitlement(
    tx: ContentEntitlementTx,
    input: GrantContentEntitlementInput,
  ) {
    const [entitlement] = await tx
      .insert(this.userContentEntitlement)
      .values({
        userId: input.userId,
        targetType: input.targetType,
        targetId: input.targetId,
        grantSource: input.grantSource,
        sourceId: input.sourceId,
        sourceKey: input.sourceKey,
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        grantSnapshot: input.grantSnapshot,
        status: ContentEntitlementStatusEnum.ACTIVE,
      })
      .returning()

    return entitlement
  }

  // 在购买事务内写入永久购买权益。
  async grantPurchaseEntitlement(
    tx: ContentEntitlementTx,
    input: GrantPurchaseEntitlementInput,
  ) {
    return this.grantEntitlement(tx, {
      ...input,
      grantSource: ContentEntitlementGrantSourceEnum.PURCHASE,
    })
  }

  // 撤销购买权益，退款或冲正后不再参与 purchased 和购买计数。
  async revokePurchaseEntitlement(
    tx: ContentEntitlementTx,
    input: ContentEntitlementTarget,
  ) {
    await tx
      .update(this.userContentEntitlement)
      .set({
        status: ContentEntitlementStatusEnum.REVOKED,
        revokedAt: new Date(),
      })
      .where(
        and(
          eq(this.userContentEntitlement.userId, input.userId),
          eq(this.userContentEntitlement.targetType, input.targetType),
          eq(this.userContentEntitlement.targetId, input.targetId),
          eq(
            this.userContentEntitlement.grantSource,
            ContentEntitlementGrantSourceEnum.PURCHASE,
          ),
          eq(
            this.userContentEntitlement.status,
            ContentEntitlementStatusEnum.ACTIVE,
          ),
        ),
      )
  }
}
