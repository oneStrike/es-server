import type { SQL } from 'drizzle-orm'
import type {
  ConsumeCouponRedemptionInput,
  ConsumeCouponRedemptionResult,
  CouponInstanceLookupInput,
  CouponTx,
  ReserveDiscountCouponInput,
} from '../coupon/types/coupon.type'
import { DrizzleService } from '@db/core'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementTargetTypeEnum,
  MembershipSubscriptionSourceTypeEnum,
  MembershipSubscriptionStatusEnum,
} from '@libs/content/permission/content-entitlement.constant'
import { ContentEntitlementService } from '@libs/content/permission/content-entitlement.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable, Logger } from '@nestjs/common'
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import {
  CouponInstanceStatusEnum,
  CouponRedemptionStatusEnum,
  CouponRedemptionTargetTypeEnum,
  CouponTypeEnum,
} from '../coupon/coupon.constant'
import {
  CreateCouponDefinitionDto,
  GrantCouponDto,
  QueryCouponDefinitionDto,
  QueryUserCouponDto,
  RedeemCouponCommandDto,
  UpdateCouponDefinitionDto,
} from '../coupon/dto/coupon.dto'

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name)

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly contentEntitlementService: ContentEntitlementService,
  ) {}

  // 获取当前请求使用的 Drizzle 查询实例。
  private get db() {
    return this.drizzle.db
  }

  // 获取用户券实例表定义。
  private get userCouponInstance() {
    return this.drizzle.schema.userCouponInstance
  }

  // 获取券定义表定义。
  private get couponDefinition() {
    return this.drizzle.schema.couponDefinition
  }

  // 获取券核销记录表定义。
  private get couponRedemptionRecord() {
    return this.drizzle.schema.couponRedemptionRecord
  }

  // 获取用户会员订阅事实表定义。
  private get userMembershipSubscription() {
    return this.drizzle.schema.userMembershipSubscription
  }

  // 向用户发放指定券定义的券实例。
  async grantCoupon(dto: GrantCouponDto) {
    const definition = await this.db.query.couponDefinition.findFirst({
      where: { id: dto.couponDefinitionId, isEnabled: true },
    })
    if (!definition) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '券定义不存在或未启用',
      )
    }
    const expiresAt =
      definition.validDays > 0
        ? this.addDays(new Date(), definition.validDays)
        : null

    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.userCouponInstance).values({
        userId: dto.userId,
        couponDefinitionId: definition.id,
        couponType: definition.couponType,
        status: CouponInstanceStatusEnum.AVAILABLE,
        remainingUses: definition.usageLimit,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        expiresAt,
        grantSnapshot: {
          couponName: definition.name,
          couponType: definition.couponType,
          targetScope: definition.targetScope,
        },
      }),
    )
    return true
  }

  // 基于输入时间增加指定天数。
  private addDays(input: Date, days: number) {
    const output = new Date(input)
    output.setDate(output.getDate() + days)
    return output
  }

  // 启用或停用券定义。
  async updateCouponDefinitionStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.couponDefinition)
          .set({ isEnabled })
          .where(eq(this.couponDefinition.id, id)),
      { notFound: '券定义不存在' },
    )
    return true
  }

  // 更新券定义。
  async updateCouponDefinition(dto: UpdateCouponDefinitionDto) {
    const { id, ...data } = dto
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.couponDefinition)
          .set(data)
          .where(eq(this.couponDefinition.id, id)),
      { notFound: '券定义不存在' },
    )
    return true
  }

  // 创建券定义。
  async createCouponDefinition(dto: CreateCouponDefinitionDto) {
    await this.drizzle.withErrorHandling(() =>
      this.db.insert(this.couponDefinition).values(dto),
    )
    return true
  }

  // 分页查询券定义。
  async getCouponDefinitionPage(dto: QueryCouponDefinitionDto) {
    const conditions: SQL[] = []
    if (dto.couponType !== undefined) {
      conditions.push(eq(this.couponDefinition.couponType, dto.couponType))
    }
    if (dto.targetScope !== undefined) {
      conditions.push(eq(this.couponDefinition.targetScope, dto.targetScope))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.couponDefinition.isEnabled, dto.isEnabled))
    }
    return this.drizzle.ext.findPagination(this.couponDefinition, {
      ...dto,
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: dto.orderBy ?? JSON.stringify({ id: 'desc' }),
    })
  }

  // 购买章节前预留折扣券并返回优惠后的应付价格。
  async reserveDiscountCoupon(tx: CouponTx, input: ReserveDiscountCouponInput) {
    const coupon = await this.getCouponInstanceWithDefinition(tx, {
      userId: input.userId,
      couponInstanceId: input.couponInstanceId,
    })
    if (coupon.couponType !== CouponTypeEnum.DISCOUNT) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '只有折扣券可以参与章节购买价格计算',
      )
    }

    const discountedByRate = Math.floor(
      (input.originalPrice * coupon.discountRateBps) / 10000,
    )
    const paidPrice = Math.max(0, discountedByRate - coupon.discountAmount)
    const discountAmount = input.originalPrice - paidPrice
    const bizKey = `discount:${input.userId}:${input.targetType}:${input.targetId}:${input.couponInstanceId}`

    const { redemption } = await this.consumeCouponAndWriteRedemption(tx, {
      ...input,
      coupon,
      bizKey,
      redemptionSnapshot: {
        originalPrice: input.originalPrice,
        paidPrice,
        discountAmount,
        discountRateBps: coupon.discountRateBps,
      },
    })

    return {
      paidPrice,
      discountAmount,
      couponInstanceId: input.couponInstanceId,
      redemptionRecordId: redemption.id,
      discountSource: CouponTypeEnum.DISCOUNT,
    }
  }

  // 扣减券可用次数并写入幂等核销记录，返回 created 控制后续副作用。
  private async consumeCouponAndWriteRedemption(
    tx: CouponTx,
    input: ConsumeCouponRedemptionInput,
  ): Promise<ConsumeCouponRedemptionResult> {
    const existing = await tx.query.couponRedemptionRecord.findFirst({
      where: {
        userId: input.userId,
        bizKey: input.bizKey,
      },
    })
    if (existing) {
      return { redemption: existing, created: false }
    }

    const nextRemainingUses = input.coupon.remainingUses - 1
    const [updated] = await tx
      .update(this.userCouponInstance)
      .set({
        remainingUses: nextRemainingUses,
        status:
          nextRemainingUses > 0
            ? CouponInstanceStatusEnum.AVAILABLE
            : CouponInstanceStatusEnum.USED_UP,
      })
      .where(
        and(
          eq(this.userCouponInstance.id, input.couponInstanceId),
          eq(this.userCouponInstance.userId, input.userId),
          eq(
            this.userCouponInstance.status,
            CouponInstanceStatusEnum.AVAILABLE,
          ),
          gt(this.userCouponInstance.remainingUses, 0),
        ),
      )
      .returning({ id: this.userCouponInstance.id })

    if (!updated) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '券已被使用或状态已变化',
      )
    }

    const [redemption] = await tx
      .insert(this.couponRedemptionRecord)
      .values({
        userId: input.userId,
        couponInstanceId: input.couponInstanceId,
        couponType: input.coupon.couponType,
        targetType: input.targetType,
        targetId: input.targetId,
        status: CouponRedemptionStatusEnum.SUCCESS,
        bizKey: input.bizKey,
        redemptionSnapshot: input.redemptionSnapshot,
      })
      .returning()

    return { redemption, created: true }
  }

  // 查询可核销的用户券实例及其定义快照。
  private async getCouponInstanceWithDefinition(
    tx: CouponTx,
    input: CouponInstanceLookupInput,
  ) {
    const rows = await tx
      .select({
        id: this.userCouponInstance.id,
        userId: this.userCouponInstance.userId,
        couponDefinitionId: this.userCouponInstance.couponDefinitionId,
        couponType: this.userCouponInstance.couponType,
        status: this.userCouponInstance.status,
        remainingUses: this.userCouponInstance.remainingUses,
        expiresAt: this.userCouponInstance.expiresAt,
        name: this.couponDefinition.name,
        targetScope: this.couponDefinition.targetScope,
        discountAmount: this.couponDefinition.discountAmount,
        discountRateBps: this.couponDefinition.discountRateBps,
        validDays: this.couponDefinition.validDays,
      })
      .from(this.userCouponInstance)
      .innerJoin(
        this.couponDefinition,
        eq(
          this.couponDefinition.id,
          this.userCouponInstance.couponDefinitionId,
        ),
      )
      .where(
        and(
          eq(this.userCouponInstance.id, input.couponInstanceId),
          eq(this.userCouponInstance.userId, input.userId),
          eq(
            this.userCouponInstance.status,
            CouponInstanceStatusEnum.AVAILABLE,
          ),
          gt(this.userCouponInstance.remainingUses, 0),
          eq(this.couponDefinition.isEnabled, true),
        ),
      )
      .limit(1)

    const coupon = rows[0]
    if (!coupon) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '可用券不存在',
      )
    }
    if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '券已过期',
      )
    }
    return coupon
  }

  // 核销用户券并在同一事务中执行对应权益发放。
  async redeemCoupon(dto: RedeemCouponCommandDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const redemption = await this.redeemCouponInTx(tx, dto)
      return redemption
    })
  }

  // 在外部事务中核销券，并仅在首次核销时执行权益发放副作用。
  private async redeemCouponInTx(tx: CouponTx, dto: RedeemCouponCommandDto) {
    const coupon = await this.getCouponInstanceWithDefinition(tx, dto)
    if (coupon.couponType === CouponTypeEnum.DISCOUNT) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '折扣券只能在章节购买命令中使用',
      )
    }
    const readingTargetType =
      coupon.couponType === CouponTypeEnum.READING
        ? this.resolveContentEntitlementTargetType(dto.targetType)
        : undefined
    if (
      coupon.couponType === CouponTypeEnum.VIP_TRIAL &&
      dto.targetType !== CouponRedemptionTargetTypeEnum.VIP
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'VIP 试用卡只能核销到 VIP',
      )
    }
    const bizKey =
      dto.bizKey ??
      `coupon:${dto.userId}:${dto.targetType}:${dto.targetId}:${dto.couponInstanceId}`
    const { redemption, created } = await this.consumeCouponAndWriteRedemption(
      tx,
      {
        ...dto,
        coupon,
        bizKey,
        redemptionSnapshot: {
          couponName: coupon.name,
          couponType: coupon.couponType,
          targetScope: coupon.targetScope,
        },
      },
    )

    if (!created) {
      return redemption
    }

    if (
      coupon.couponType === CouponTypeEnum.READING &&
      readingTargetType !== undefined
    ) {
      await this.contentEntitlementService.grantEntitlement(tx, {
        userId: dto.userId,
        targetType: readingTargetType,
        targetId: dto.targetId,
        grantSource: ContentEntitlementGrantSourceEnum.COUPON,
        sourceId: redemption.id,
        sourceKey: bizKey,
        expiresAt: coupon.expiresAt ?? this.addDays(new Date(), 30),
        grantSnapshot: {
          couponInstanceId: dto.couponInstanceId,
          couponDefinitionId: coupon.couponDefinitionId,
          redemptionRecordId: redemption.id,
        },
      })
    }

    if (coupon.couponType === CouponTypeEnum.VIP_TRIAL) {
      const now = new Date()
      await tx.insert(this.userMembershipSubscription).values({
        userId: dto.userId,
        sourceType: MembershipSubscriptionSourceTypeEnum.VIP_TRIAL_COUPON,
        sourceId: redemption.id,
        status: MembershipSubscriptionStatusEnum.ACTIVE,
        startsAt: now,
        endsAt: this.addDays(now, Math.max(1, coupon.validDays)),
        sourceSnapshot: {
          couponInstanceId: dto.couponInstanceId,
          couponDefinitionId: coupon.couponDefinitionId,
          redemptionRecordId: redemption.id,
        },
      })
    }

    return redemption
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

  // 分页查询用户当前可用券实例。
  async getUserCouponPage(userId: number, dto: QueryUserCouponDto) {
    const page = this.drizzle.buildPage(dto)
    const conditions = [
      eq(this.userCouponInstance.userId, userId),
      eq(this.userCouponInstance.status, CouponInstanceStatusEnum.AVAILABLE),
      gt(this.userCouponInstance.remainingUses, 0),
    ]
    if (dto.couponType !== undefined) {
      conditions.push(eq(this.userCouponInstance.couponType, dto.couponType))
    }

    const [rows, totalRows] = await Promise.all([
      this.db
        .select({
          id: this.userCouponInstance.id,
          userId: this.userCouponInstance.userId,
          couponDefinitionId: this.userCouponInstance.couponDefinitionId,
          couponType: this.userCouponInstance.couponType,
          status: this.userCouponInstance.status,
          remainingUses: this.userCouponInstance.remainingUses,
          expiresAt: this.userCouponInstance.expiresAt,
          createdAt: this.userCouponInstance.createdAt,
          updatedAt: this.userCouponInstance.updatedAt,
          name: this.couponDefinition.name,
        })
        .from(this.userCouponInstance)
        .innerJoin(
          this.couponDefinition,
          eq(
            this.couponDefinition.id,
            this.userCouponInstance.couponDefinitionId,
          ),
        )
        .where(and(...conditions))
        .orderBy(desc(this.userCouponInstance.createdAt))
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(this.userCouponInstance)
        .where(and(...conditions)),
    ])

    return {
      list: rows,
      total: Number(totalRows[0]?.total ?? 0),
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }
}
