import type { SQL } from 'drizzle-orm'
import type {
  ConsumeCouponRedemptionInput,
  ConsumeCouponRedemptionResult,
  CouponAbilityDefinition,
  CouponGrantSnapshot,
  CouponGrantSnapshotSource,
  CouponInstanceLookupInput,
  CouponTx,
  GrantCouponsForSourceInput,
  GrantCouponsForSourceResult,
  ReserveDiscountCouponInput,
  WritableCouponDefinition,
} from '../coupon/types/coupon.type'
import { createHash } from 'node:crypto'
import { DrizzleService, toPageResult } from '@db/core'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementTargetTypeEnum,
  MembershipSubscriptionSourceTypeEnum,
  MembershipSubscriptionStatusEnum,
} from '@libs/content/permission/content-entitlement.constant'
import { ContentEntitlementService } from '@libs/content/permission/content-entitlement.service'
import { CheckInService } from '@libs/growth/check-in/check-in.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Injectable, Logger } from '@nestjs/common'
import { and, eq, gt, gte, isNull, lt, or, sql } from 'drizzle-orm'
import {
  CouponInstanceStatusEnum,
  CouponRedemptionStatusEnum,
  CouponRedemptionTargetTypeEnum,
  CouponSourceTypeEnum,
  CouponTargetScopeEnum,
  CouponTypeEnum,
} from '../coupon/coupon.constant'
import {
  CouponDefinitionOutputDto,
  CouponRedemptionResultDto,
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
    private readonly checkInService: CheckInService,
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
    await this.drizzle.withTransaction(async (tx) => {
      const operationId = dto.operationId?.trim() ?? ''
      if (!operationId) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '后台发券操作幂等 ID 不能为空',
        )
      }
      const quantity = dto.quantity ?? 1
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '发券数量必须为正整数',
        )
      }
      const grantKeyPrefix = this.buildAdminGrantKeyPrefix(operationId)
      const grantKeys = Array.from(
        { length: quantity },
        (_, index) => `${grantKeyPrefix}${index}`,
      )
      const grantInput: GrantCouponsForSourceInput = {
        couponDefinitionId: dto.couponDefinitionId,
        grantKeys,
        quantity,
        sourceId: dto.sourceId,
        sourceType: CouponSourceTypeEnum.ADMIN_GRANT,
        userId: dto.userId,
      }
      await this.ensureAdminGrantOperationLock(tx, {
        operationId,
        userId: dto.userId,
      })
      await this.ensureAdminGrantOperationReplayCompatible(
        tx,
        grantInput,
        grantKeys,
        grantKeyPrefix,
      )
      await this.grantCouponsForSource(tx, grantInput)
    })
    return true
  }

  // 通用发券入口，支持数量、有效期覆盖和 grantKey 幂等。
  async grantCouponsForSource(
    tx: CouponTx,
    input: GrantCouponsForSourceInput,
  ): Promise<GrantCouponsForSourceResult> {
    const quantity = input.quantity ?? 1
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '发券数量必须为正整数',
      )
    }
    if (
      input.validDays !== undefined &&
      input.validDays !== null &&
      (!Number.isInteger(input.validDays) || input.validDays < 1)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '发券有效天数必须为正整数',
      )
    }
    if (input.grantKeys !== undefined && input.grantKeys.length !== quantity) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '发券幂等键数量必须和发券数量一致',
      )
    }
    const grantKeys = input.grantKeys?.map((item) => item.trim()) ?? []
    if (grantKeys.includes('')) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '发券幂等键不能为空',
      )
    }

    const definition = await tx.query.couponDefinition.findFirst({
      where: { id: input.couponDefinitionId, isEnabled: true },
    })
    if (!definition) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '券定义不存在或未启用',
      )
    }
    const [user] = await tx
      .select({ id: this.drizzle.schema.appUser.id })
      .from(this.drizzle.schema.appUser)
      .where(eq(this.drizzle.schema.appUser.id, input.userId))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
    this.assertCouponAbility(definition)
    const validDays = input.validDays ?? definition.validDays
    const grantSnapshot = this.buildGrantSnapshot({
      ...definition,
      validDays,
    })
    const expiresAt = validDays > 0 ? this.addDays(new Date(), validDays) : null
    const items: GrantCouponsForSourceResult['items'] = []

    for (let index = 0; index < quantity; index += 1) {
      const grantKey = grantKeys[index] ?? null
      const insertRows = await tx
        .insert(this.userCouponInstance)
        .values({
          userId: input.userId,
          couponDefinitionId: definition.id,
          couponType: definition.couponType,
          status: CouponInstanceStatusEnum.AVAILABLE,
          remainingUses: definition.usageLimit,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          grantKey,
          expiresAt,
          grantSnapshot,
        })
        .onConflictDoNothing()
        .returning()
      const couponInstance =
        insertRows[0] ??
        (grantKey
          ? await this.findCouponInstanceByGrantKey(tx, input.userId, grantKey)
          : null)
      if (!couponInstance) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '发券幂等记录状态异常',
        )
      }
      if (!insertRows[0] && grantKey) {
        this.assertGrantKeyReplayShape(couponInstance, input, grantKey)
      }
      items.push({
        grantKey,
        couponInstance,
        created: insertRows.length > 0,
      })
    }

    return {
      items,
      createdCount: items.filter((item) => item.created).length,
    }
  }

  // 基于输入时间增加指定天数。
  private addDays(input: Date, days: number) {
    const output = new Date(input)
    output.setDate(output.getDate() + days)
    return output
  }

  private buildAdminGrantKeyPrefix(operationId: string) {
    const operationHash = createHash('sha256')
      .update(operationId)
      .digest('base64url')
    return `admin-grant:${operationHash}:`
  }

  private async ensureAdminGrantOperationLock(
    tx: CouponTx,
    input: {
      operationId: string
      userId: number
    },
  ) {
    await this.drizzle.withErrorHandling(() =>
      tx.execute(
        sql`SELECT pg_advisory_xact_lock(${input.userId}, hashtext(${input.operationId}))`,
      ),
    )
  }

  private async ensureAdminGrantOperationReplayCompatible(
    tx: CouponTx,
    input: GrantCouponsForSourceInput,
    grantKeys: string[],
    grantKeyPrefix: string,
  ) {
    const existingRows = await this.findCouponInstancesByGrantKeyPrefix(
      tx,
      input.userId,
      grantKeyPrefix,
    )
    if (existingRows.length === 0) {
      return
    }

    const expectedKeys = new Set(grantKeys)
    if (existingRows.length !== grantKeys.length) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '后台发券操作幂等 ID 已被不同数量的发券请求使用',
      )
    }

    for (const row of existingRows) {
      if (!row.grantKey || !expectedKeys.has(row.grantKey)) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '后台发券操作幂等 ID 已被不同数量的发券请求使用',
        )
      }
      this.assertGrantKeyReplayShape(row, input, row.grantKey)
    }
  }

  private async findCouponInstancesByGrantKeyPrefix(
    tx: CouponTx,
    userId: number,
    grantKeyPrefix: string,
  ) {
    return tx
      .select()
      .from(this.userCouponInstance)
      .where(
        and(
          eq(this.userCouponInstance.userId, userId),
          sql`starts_with(${this.userCouponInstance.grantKey}, ${grantKeyPrefix})`,
        ),
      )
  }

  private async findCouponInstanceByGrantKey(
    tx: CouponTx,
    userId: number,
    grantKey: string,
  ) {
    const [row] = await tx
      .select()
      .from(this.userCouponInstance)
      .where(
        and(
          eq(this.userCouponInstance.userId, userId),
          eq(this.userCouponInstance.grantKey, grantKey),
        ),
      )
      .limit(1)
    return row ?? null
  }

  private assertGrantKeyReplayShape(
    existing: {
      couponDefinitionId: number
      sourceType: number
      sourceId?: number | null
      grantKey?: string | null
    },
    input: GrantCouponsForSourceInput,
    grantKey: string,
  ) {
    if (
      existing.grantKey !== undefined &&
      existing.grantKey !== null &&
      existing.grantKey !== grantKey
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '发券幂等键已被不同发券请求使用',
      )
    }
    if (
      existing.couponDefinitionId !== input.couponDefinitionId ||
      existing.sourceType !== input.sourceType ||
      (existing.sourceId ?? null) !== (input.sourceId ?? null)
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '发券幂等键已被不同发券请求使用',
      )
    }
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
    const existing = await this.db.query.couponDefinition.findFirst({
      where: { id },
    })
    if (!existing) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '券定义不存在',
      )
    }
    const normalizedData = this.normalizeCouponDefinitionUpdate(data, existing)
    await this.drizzle.withErrorHandling(
      () =>
        this.db
          .update(this.couponDefinition)
          .set(normalizedData)
          .where(eq(this.couponDefinition.id, id)),
      { notFound: '券定义不存在' },
    )
    return true
  }

  // 创建券定义。
  async createCouponDefinition(dto: CreateCouponDefinitionDto) {
    await this.drizzle.withErrorHandling(() =>
      this.db
        .insert(this.couponDefinition)
        .values(this.normalizeCouponDefinitionWrite(dto)),
    )
    return true
  }

  // 更新券类型时不继承旧能力字段，避免保存出新类型下不完整的券能力。
  private normalizeCouponDefinitionUpdate(
    data: Omit<UpdateCouponDefinitionDto, 'id'>,
    existing: CreateCouponDefinitionDto,
  ) {
    const nextCouponType = data.couponType ?? existing.couponType
    const base = {
      name: data.name ?? existing.name,
      couponType: nextCouponType,
      validDays: data.validDays ?? existing.validDays,
      isEnabled: data.isEnabled ?? existing.isEnabled,
    }
    const typeChanged = nextCouponType !== existing.couponType
    if (typeChanged) {
      return this.normalizeCouponDefinitionWrite({
        ...base,
        ...(data.discountAmount !== undefined
          ? { discountAmount: data.discountAmount }
          : {}),
        ...(data.discountRateBps !== undefined
          ? { discountRateBps: data.discountRateBps }
          : {}),
        ...(data.usageLimit !== undefined
          ? { usageLimit: data.usageLimit }
          : {}),
        ...(data.benefitDays !== undefined
          ? { benefitDays: data.benefitDays }
          : {}),
        ...(data.benefitCount !== undefined
          ? { benefitCount: data.benefitCount }
          : {}),
      })
    }

    return this.normalizeCouponDefinitionWrite({
      ...base,
      discountAmount: data.discountAmount ?? existing.discountAmount,
      discountRateBps: data.discountRateBps ?? existing.discountRateBps,
      usageLimit: data.usageLimit ?? existing.usageLimit,
      benefitDays: data.benefitDays ?? existing.benefitDays,
      benefitCount: data.benefitCount ?? existing.benefitCount,
    })
  }

  // 按券能力派生目标范围并清理无关能力字段。
  private normalizeCouponDefinitionWrite(dto: CreateCouponDefinitionDto) {
    const validDays = dto.validDays ?? 7
    if (!Number.isInteger(validDays) || validDays < 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '券定义有效天数必须为正整数',
      )
    }
    const base = {
      ...dto,
      discountAmount: 0,
      discountRateBps: 10000,
      usageLimit: 1,
      validDays,
      benefitDays: 0,
      benefitCount: 0,
    }

    if (dto.couponType === CouponTypeEnum.READING) {
      return this.ensureCouponDefinitionWritable({
        ...base,
        targetScope: CouponTargetScopeEnum.CHAPTER,
        usageLimit: dto.usageLimit ?? 1,
      })
    }

    if (dto.couponType === CouponTypeEnum.DISCOUNT) {
      if (
        (dto.discountAmount ?? 0) <= 0 &&
        (dto.discountRateBps ?? 10000) >= 10000
      ) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '折扣券必须配置折扣金额或折扣率',
        )
      }
      return this.ensureCouponDefinitionWritable({
        ...base,
        targetScope: CouponTargetScopeEnum.CHAPTER,
        discountAmount: dto.discountAmount ?? 0,
        discountRateBps: dto.discountRateBps ?? 10000,
      })
    }

    if (dto.couponType === CouponTypeEnum.VIP_TRIAL) {
      return this.ensureCouponDefinitionWritable({
        ...base,
        targetScope: CouponTargetScopeEnum.VIP,
        benefitDays: dto.benefitDays ?? 1,
      })
    }

    if (dto.couponType === CouponTypeEnum.CHECK_IN_MAKEUP) {
      return this.ensureCouponDefinitionWritable({
        ...base,
        targetScope: CouponTargetScopeEnum.CHECK_IN,
        benefitCount: dto.benefitCount ?? 1,
      })
    }

    throw new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      '不支持的券类型',
    )
  }

  private ensureCouponDefinitionWritable<T extends WritableCouponDefinition>(
    definition: T,
  ) {
    this.assertCouponAbility(definition)
    return definition
  }

  private assertCouponAbility(definition: CouponAbilityDefinition) {
    if (
      definition.couponType === CouponTypeEnum.READING &&
      (definition.targetScope !== CouponTargetScopeEnum.CHAPTER ||
        definition.usageLimit < 1)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '阅读券能力配置不完整',
      )
    }

    if (
      definition.couponType === CouponTypeEnum.DISCOUNT &&
      (definition.targetScope !== CouponTargetScopeEnum.CHAPTER ||
        (definition.discountAmount <= 0 && definition.discountRateBps >= 10000))
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '折扣券必须配置折扣金额或折扣率',
      )
    }

    if (
      definition.couponType === CouponTypeEnum.VIP_TRIAL &&
      (definition.targetScope !== CouponTargetScopeEnum.VIP ||
        definition.benefitDays < 1)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        'VIP 试用卡必须配置试用天数',
      )
    }

    if (
      definition.couponType === CouponTypeEnum.CHECK_IN_MAKEUP &&
      (definition.targetScope !== CouponTargetScopeEnum.CHECK_IN ||
        definition.benefitCount < 1)
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '补签卡必须配置补签次数',
      )
    }
  }

  private buildGrantSnapshot(
    definition: CouponGrantSnapshotSource,
  ): CouponGrantSnapshot {
    return {
      name: definition.name,
      couponType: definition.couponType,
      targetScope: definition.targetScope,
      usageLimit: definition.usageLimit,
      discountRateBps: definition.discountRateBps,
      discountAmount: definition.discountAmount,
      benefitDays: definition.benefitDays,
      benefitCount: definition.benefitCount,
      validDays: definition.validDays,
      issuedAt: new Date().toISOString(),
    }
  }

  private parseGrantSnapshot(snapshot: unknown): CouponGrantSnapshot {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '券发放快照缺失',
      )
    }
    const value = snapshot as Record<string, unknown>
    const couponType = this.readSnapshotNumber(value.couponType, 'couponType')
    const targetScope = this.readSnapshotNumber(
      value.targetScope,
      'targetScope',
    )
    return {
      name:
        this.readSnapshotString(value.name) ??
        this.throwInvalidGrantSnapshot('券发放快照名称缺失'),
      couponType,
      targetScope,
      usageLimit: this.readSnapshotNumber(value.usageLimit, 'usageLimit'),
      discountRateBps: this.readSnapshotNumber(
        value.discountRateBps,
        'discountRateBps',
      ),
      discountAmount: this.readSnapshotNumber(
        value.discountAmount,
        'discountAmount',
      ),
      benefitDays: this.readSnapshotNumber(value.benefitDays, 'benefitDays'),
      benefitCount: this.readSnapshotNumber(value.benefitCount, 'benefitCount'),
      validDays: this.readSnapshotNumber(value.validDays, 'validDays'),
      issuedAt:
        this.readSnapshotString(value.issuedAt) ??
        this.throwInvalidGrantSnapshot('券发放快照发放时间缺失'),
    }
  }

  private readSnapshotString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value : undefined
  }

  private readSnapshotNumber(value: unknown, fieldName: string) {
    if (value === null || value === undefined || value === '') {
      this.throwInvalidGrantSnapshot(`券发放快照 ${fieldName} 缺失`)
    }
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      this.throwInvalidGrantSnapshot(`券发放快照 ${fieldName} 缺失`)
    }
    return parsed
  }

  private throwInvalidGrantSnapshot(message: string): never {
    throw new BusinessException(BusinessErrorCode.STATE_CONFLICT, message)
  }

  // 分页查询券定义。
  async getCouponDefinitionPage(dto: QueryCouponDefinitionDto) {
    const conditions: SQL[] = []
    if (dto.couponType !== undefined) {
      conditions.push(eq(this.couponDefinition.couponType, dto.couponType))
    }
    if (dto.isEnabled !== undefined) {
      conditions.push(eq(this.couponDefinition.isEnabled, dto.isEnabled))
    }
    const dateRange = buildDateOnlyRangeInAppTimeZone(
      dto.startDate,
      dto.endDate,
    )
    if (dateRange?.gte) {
      conditions.push(
        sql`${this.couponDefinition.createdAt} >= ${dateRange.gte}`,
      )
    }
    if (dateRange?.lt) {
      conditions.push(sql`${this.couponDefinition.createdAt} < ${dateRange.lt}`)
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(dto)
    const orderQuery = this.drizzle.buildOrderBy(
      dto.orderBy ?? JSON.stringify({ id: 'desc' }),
      { table: this.couponDefinition },
    )
    const [list, total] = await Promise.all([
      this.db
        .select()
        .from(this.couponDefinition)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.couponDefinition, where),
    ])

    return toPageResult(
      list.map((coupon) => this.toCouponDefinitionOutputDto(coupon)),
      total,
      page,
    )
  }

  private toCouponDefinitionOutputDto(
    coupon: typeof this.couponDefinition.$inferSelect,
  ): CouponDefinitionOutputDto {
    return {
      ...coupon,
      discountAmount: coupon.discountAmount ?? 0,
      discountRateBps: coupon.discountRateBps ?? 10000,
      usageLimit: coupon.usageLimit ?? 1,
      validDays: coupon.validDays ?? 0,
      benefitDays: coupon.benefitDays ?? 0,
      benefitCount: coupon.benefitCount ?? 0,
      isEnabled: coupon.isEnabled ?? true,
    }
  }

  // 购买章节前预留折扣券并返回优惠后的应付价格。
  async reserveDiscountCoupon(tx: CouponTx, input: ReserveDiscountCouponInput) {
    const coupon = await this.getCouponInstanceWithDefinition(tx, {
      userId: input.userId,
      couponInstanceId: input.couponInstanceId,
    })
    this.assertSnapshotCouponType(coupon)
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
    const [insertedRedemption] = await tx
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
      .onConflictDoNothing({
        target: [
          this.couponRedemptionRecord.userId,
          this.couponRedemptionRecord.bizKey,
        ],
      })
      .returning()

    if (!insertedRedemption) {
      const existing = await tx.query.couponRedemptionRecord.findFirst({
        where: {
          userId: input.userId,
          bizKey: input.bizKey,
        },
      })
      if (!existing) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '券核销幂等记录状态异常',
        )
      }
      this.assertRedemptionReplayShape(existing, input)
      return { redemption: existing, created: false }
    }

    const [updated] = await tx
      .update(this.userCouponInstance)
      .set({
        remainingUses: sql`${this.userCouponInstance.remainingUses} - 1`,
        status: sql`case when ${this.userCouponInstance.remainingUses} - 1 > 0 then ${CouponInstanceStatusEnum.AVAILABLE} else ${CouponInstanceStatusEnum.USED_UP} end`,
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
          or(
            isNull(this.userCouponInstance.expiresAt),
            gt(this.userCouponInstance.expiresAt, new Date()),
          ),
        ),
      )
      .returning({ remainingUses: this.userCouponInstance.remainingUses })

    if (!updated) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '券已被使用或状态已变化',
      )
    }

    return { redemption: insertedRedemption, created: true }
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
        grantSnapshot: this.userCouponInstance.grantSnapshot,
        name: sql<string>`${this.userCouponInstance.grantSnapshot}->>'name'`,
        targetScope: sql<number>`(${this.userCouponInstance.grantSnapshot}->>'targetScope')::int`,
        discountAmount: sql<number>`(${this.userCouponInstance.grantSnapshot}->>'discountAmount')::int`,
        discountRateBps: sql<number>`(${this.userCouponInstance.grantSnapshot}->>'discountRateBps')::int`,
        validDays: sql<number>`(${this.userCouponInstance.grantSnapshot}->>'validDays')::int`,
        benefitDays: sql<number>`(${this.userCouponInstance.grantSnapshot}->>'benefitDays')::int`,
        benefitCount: sql<number>`(${this.userCouponInstance.grantSnapshot}->>'benefitCount')::int`,
      })
      .from(this.userCouponInstance)
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
      .limit(1)

    const row = rows[0]
    if (!row) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '可用券不存在',
      )
    }
    if (row.expiresAt && row.expiresAt <= new Date()) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '券已过期',
      )
    }
    const snapshot = this.parseGrantSnapshot(row.grantSnapshot)
    return {
      ...row,
      name: snapshot.name,
      targetScope: snapshot.targetScope,
      discountAmount: snapshot.discountAmount,
      discountRateBps: snapshot.discountRateBps,
      validDays: snapshot.validDays,
      benefitDays: snapshot.benefitDays,
      benefitCount: snapshot.benefitCount,
    }
  }

  // 核销用户券并在同一事务中执行对应权益发放。
  async redeemCoupon(dto: RedeemCouponCommandDto) {
    return this.drizzle.withTransaction(async (tx) => {
      const redemption = await this.redeemCouponInTx(tx, dto)
      return this.toCouponRedemptionResultDto(redemption)
    })
  }

  // 在外部事务中核销券，并仅在首次核销时执行权益发放副作用。
  private async redeemCouponInTx(tx: CouponTx, dto: RedeemCouponCommandDto) {
    const coupon = await this.getCouponInstanceWithDefinition(tx, dto)
    this.assertSnapshotCouponType(coupon)
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
    if (
      coupon.couponType === CouponTypeEnum.CHECK_IN_MAKEUP &&
      dto.targetType !== CouponRedemptionTargetTypeEnum.CHECK_IN
    ) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '补签卡只能核销到签到',
      )
    }
    const bizKey =
      dto.bizKey ??
      `coupon:${dto.userId}:${dto.targetType}:${dto.targetId ?? 0}:${dto.couponInstanceId}`
    const { redemption, created } = await this.consumeCouponAndWriteRedemption(
      tx,
      {
        ...dto,
        targetId: dto.targetId ?? null,
        coupon,
        bizKey,
        redemptionSnapshot: {
          name: coupon.name,
          couponType: coupon.couponType,
          targetScope: coupon.targetScope,
          benefitDays: coupon.benefitDays,
          benefitCount: coupon.benefitCount,
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
        targetId: this.requireTargetId(dto.targetId, '阅读券核销目标不能为空'),
        grantSource: ContentEntitlementGrantSourceEnum.COUPON,
        sourceId: redemption.id,
        sourceKey: bizKey,
        expiresAt: this.resolveReadingEntitlementExpiresAt(coupon),
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
        endsAt: this.addDays(now, Math.max(1, coupon.benefitDays)),
        sourceSnapshot: {
          couponInstanceId: dto.couponInstanceId,
          couponDefinitionId: coupon.couponDefinitionId,
          redemptionRecordId: redemption.id,
        },
      })
    }

    if (coupon.couponType === CouponTypeEnum.CHECK_IN_MAKEUP) {
      await this.checkInService.grantEventMakeupAllowance(tx, {
        userId: dto.userId,
        amount: Math.max(1, coupon.benefitCount),
        sourceRef: `coupon_redemption:${redemption.id}`,
        bizKey,
        context: {
          source: 'coupon_check_in_makeup',
          couponInstanceId: dto.couponInstanceId,
          couponDefinitionId: coupon.couponDefinitionId,
          redemptionRecordId: redemption.id,
        },
      })
    }

    return redemption
  }

  private assertRedemptionReplayShape(
    existing: {
      couponInstanceId: number
      couponType: number
      targetType: number
      targetId?: number | null
      status: number
    },
    input: ConsumeCouponRedemptionInput,
  ) {
    if (
      existing.status !== CouponRedemptionStatusEnum.SUCCESS ||
      existing.couponInstanceId !== input.couponInstanceId ||
      existing.couponType !== input.coupon.couponType ||
      existing.targetType !== input.targetType ||
      (existing.targetId ?? null) !== (input.targetId ?? null)
    ) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '券核销幂等键已被不同核销请求使用',
      )
    }
  }

  private resolveReadingEntitlementExpiresAt(coupon: {
    expiresAt?: Date | null
    validDays: number
  }) {
    if (coupon.expiresAt) {
      return coupon.expiresAt
    }
    if (coupon.validDays > 0) {
      return this.addDays(new Date(), coupon.validDays)
    }
    return null
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
    const pageParams = this.drizzle.buildPageParams(dto, {
      table: this.userCouponInstance,
      fallbackOrderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const now = new Date()
    const conditions = [
      eq(this.userCouponInstance.userId, userId),
      eq(this.userCouponInstance.status, CouponInstanceStatusEnum.AVAILABLE),
      gt(this.userCouponInstance.remainingUses, 0),
      or(
        isNull(this.userCouponInstance.expiresAt),
        gt(this.userCouponInstance.expiresAt, now),
      ),
    ]
    if (dto.couponType !== undefined) {
      conditions.push(eq(this.userCouponInstance.couponType, dto.couponType))
    }
    if (pageParams.dateRange?.gte) {
      conditions.push(
        gte(this.userCouponInstance.createdAt, pageParams.dateRange.gte),
      )
    }
    if (pageParams.dateRange?.lt) {
      conditions.push(
        lt(this.userCouponInstance.createdAt, pageParams.dateRange.lt),
      )
    }

    const where = and(...conditions)
    const [rows, total] = await Promise.all([
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
          grantSnapshot: this.userCouponInstance.grantSnapshot,
        })
        .from(this.userCouponInstance)
        .where(where)
        .orderBy(...pageParams.order.orderBySql)
        .limit(pageParams.page.limit)
        .offset(pageParams.page.offset),
      this.db.$count(this.userCouponInstance, where),
    ])
    const pageResult = toPageResult(rows, total, pageParams.page)

    return {
      ...pageResult,
      list: pageResult.list.map(({ grantSnapshot, ...row }) => ({
        ...row,
        name: this.parseGrantSnapshot(grantSnapshot).name,
        expiresAt: row.expiresAt ?? null,
      })),
    }
  }

  private requireTargetId(
    targetId: number | null | undefined,
    message: string,
  ) {
    if (targetId === undefined || targetId === null) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        message,
      )
    }
    return targetId
  }

  private assertSnapshotCouponType(coupon: {
    couponType: number
    grantSnapshot: unknown
  }) {
    const snapshot = this.parseGrantSnapshot(coupon.grantSnapshot)
    if (snapshot.couponType !== coupon.couponType) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '券实例类型与发放快照不一致',
      )
    }
  }

  private toCouponRedemptionResultDto(redemption: {
    id: number
    createdAt: Date
    updatedAt: Date
    couponInstanceId: number
    couponType: CouponTypeEnum
    targetType: CouponRedemptionTargetTypeEnum
    targetId?: number | null
  }): CouponRedemptionResultDto {
    return {
      id: redemption.id,
      createdAt: redemption.createdAt,
      updatedAt: redemption.updatedAt,
      couponInstanceId: redemption.couponInstanceId,
      couponType: redemption.couponType,
      targetType: redemption.targetType,
      targetId: redemption.targetId ?? null,
    }
  }
}
