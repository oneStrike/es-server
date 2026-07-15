import type { DbExecutor, IntegrityLockRequest } from '@db/core'
import type {
  CouponDefinitionSelect,
  CouponRedemptionRecordSelect,
  UserCouponInstanceSelect,
} from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  ConsumeCouponRedemptionInput,
  CouponAbilityDefinition,
  CouponDefinitionUpdateInput,
  CouponGrantSnapshot,
  CouponGrantSnapshotSource,
  CouponInstanceLookupInput,
  CouponInstanceWithDefinition,
  CouponTx,
  DiscountCouponReservationApplyResult,
  GrantCouponsForSourceInput,
  GrantCouponsForSourceResult,
  PreparedDiscountCouponReservation,
  ReserveDiscountCouponInput,
  WritableCouponDefinition,
} from '../coupon/types/coupon.type'
import type { CouponContentPort } from './types/coupon-content-port.type'
import { createHash } from 'node:crypto'
import {
  acquireIntegrityLocks,
  DrizzleService,
  exclusiveIntegrityLock,
  relationIntegrityLock,
  sharedIntegrityLock,
  tableIntegrityLock,
  toPageResult,
} from '@db/core'
import { CheckInService } from '@libs/growth/check-in/check-in.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { buildDateOnlyRangeInAppTimeZone } from '@libs/platform/utils'
import { Inject, Injectable } from '@nestjs/common'
import {
  and,
  eq,
  getTableName,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm'
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
import {
  MembershipSubscriptionSourceTypeEnum,
  MembershipSubscriptionStatusEnum,
} from '../membership/membership.constant'
import { COUPON_CONTENT_PORT } from './coupon-content.port'

const COUPON_GRANT_INSERT_CHUNK_SIZE = 500

type CouponDefinitionPageRow = Pick<
  CouponDefinitionSelect,
  | 'id'
  | 'name'
  | 'couponType'
  | 'targetScope'
  | 'discountAmount'
  | 'discountRateBps'
  | 'usageLimit'
  | 'validDays'
  | 'benefitDays'
  | 'benefitCount'
  | 'isEnabled'
  | 'createdAt'
  | 'updatedAt'
>

type CouponDefinitionUpdateSource = Pick<
  CouponDefinitionSelect,
  | 'name'
  | 'couponType'
  | 'discountAmount'
  | 'discountRateBps'
  | 'usageLimit'
  | 'validDays'
  | 'benefitDays'
  | 'benefitCount'
  | 'isEnabled'
>

type CouponGrantDefinitionSource = Pick<
  CouponDefinitionSelect,
  | 'id'
  | 'name'
  | 'couponType'
  | 'targetScope'
  | 'discountAmount'
  | 'discountRateBps'
  | 'usageLimit'
  | 'validDays'
  | 'benefitDays'
  | 'benefitCount'
>

type CouponGrantReplaySource = Pick<
  UserCouponInstanceSelect,
  'couponDefinitionId' | 'sourceType' | 'sourceId' | 'grantKey'
>

type CouponRedemptionResultSource = Pick<
  CouponRedemptionRecordSelect,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'couponInstanceId'
  | 'couponType'
  | 'targetType'
  | 'targetId'
  | 'status'
>

interface CouponRedemptionConsumeResult {
  redemption: CouponRedemptionResultSource
  created: boolean
}

@Injectable()
export class CouponService {
  constructor(
    private readonly drizzle: DrizzleService,
    @Inject(COUPON_CONTENT_PORT)
    private readonly couponContentPort: CouponContentPort,
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

  private get couponDefinitionExistsColumns() {
    return {
      id: true,
    } as const
  }

  private get couponDefinitionUpdateColumns() {
    return {
      name: true,
      couponType: true,
      discountAmount: true,
      discountRateBps: true,
      usageLimit: true,
      validDays: true,
      benefitDays: true,
      benefitCount: true,
      isEnabled: true,
    } as const
  }

  private get couponGrantDefinitionColumns() {
    return {
      id: true,
      name: true,
      couponType: true,
      targetScope: true,
      discountAmount: true,
      discountRateBps: true,
      usageLimit: true,
      validDays: true,
      benefitDays: true,
      benefitCount: true,
    } as const
  }

  private get couponGrantReplayProjection() {
    return {
      couponDefinitionId: this.userCouponInstance.couponDefinitionId,
      sourceType: this.userCouponInstance.sourceType,
      sourceId: this.userCouponInstance.sourceId,
      grantKey: this.userCouponInstance.grantKey,
    } as const
  }

  private get couponRedemptionResultColumns() {
    return {
      id: true,
      createdAt: true,
      updatedAt: true,
      couponInstanceId: true,
      couponType: true,
      targetType: true,
      targetId: true,
      status: true,
    } as const
  }

  private get couponRedemptionResultProjection() {
    return {
      id: this.couponRedemptionRecord.id,
      createdAt: this.couponRedemptionRecord.createdAt,
      updatedAt: this.couponRedemptionRecord.updatedAt,
      couponInstanceId: this.couponRedemptionRecord.couponInstanceId,
      couponType: this.couponRedemptionRecord.couponType,
      targetType: this.couponRedemptionRecord.targetType,
      targetId: this.couponRedemptionRecord.targetId,
      status: this.couponRedemptionRecord.status,
    } as const
  }

  private get couponDefinitionPageSelect() {
    return {
      id: this.couponDefinition.id,
      name: this.couponDefinition.name,
      couponType: this.couponDefinition.couponType,
      targetScope: this.couponDefinition.targetScope,
      discountAmount: this.couponDefinition.discountAmount,
      discountRateBps: this.couponDefinition.discountRateBps,
      usageLimit: this.couponDefinition.usageLimit,
      validDays: this.couponDefinition.validDays,
      benefitDays: this.couponDefinition.benefitDays,
      benefitCount: this.couponDefinition.benefitCount,
      isEnabled: this.couponDefinition.isEnabled,
      createdAt: this.couponDefinition.createdAt,
      updatedAt: this.couponDefinition.updatedAt,
    }
  }

  // 获取用户会员订阅事实表定义。
  private get userMembershipSubscription() {
    return this.drizzle.schema.userMembershipSubscription
  }

  /** 为发券业务根构造券定义与用户父记录的完整共享锁请求。 */
  buildGrantParentLockRequests(
    input: Pick<GrantCouponsForSourceInput, 'couponDefinitionId' | 'userId'>,
  ): IntegrityLockRequest[] {
    return [
      sharedIntegrityLock(
        tableIntegrityLock(
          getTableName(this.couponDefinition),
          input.couponDefinitionId,
        ),
      ),
      sharedIntegrityLock(
        tableIntegrityLock(
          getTableName(this.drizzle.schema.appUser),
          input.userId,
        ),
      ),
    ]
  }

  /** 券定义写入与发券使用同一把锁，避免停用或能力更新穿插进发券快照构建。 */
  private async lockCouponDefinition(tx: CouponTx, couponDefinitionId: number) {
    await acquireIntegrityLocks(tx, [
      exclusiveIntegrityLock(
        tableIntegrityLock(
          getTableName(this.couponDefinition),
          couponDefinitionId,
        ),
      ),
    ])
  }

  /** 锁后确认券定义仍然存在，状态切换只依赖此最小事实。 */
  private async assertCouponDefinitionExistsForUpdate(
    tx: CouponTx,
    couponDefinitionId: number,
  ) {
    const definition = await tx.query.couponDefinition.findFirst({
      where: { id: couponDefinitionId },
      columns: this.couponDefinitionExistsColumns,
    })
    if (!definition) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '券定义不存在',
      )
    }
  }

  /** 锁后读取券定义更新归一化所需的最小字段。 */
  private async readCouponDefinitionForUpdate(
    tx: CouponTx,
    couponDefinitionId: number,
  ): Promise<CouponDefinitionUpdateSource> {
    const definition = await tx.query.couponDefinition.findFirst({
      where: { id: couponDefinitionId },
      columns: this.couponDefinitionUpdateColumns,
    })
    if (!definition) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '券定义不存在',
      )
    }
    return definition
  }

  // 核销前锁定券实例与用户；券种业务分支自行校验目标契约。
  private async lockCouponInstanceAndUserForRedemption(
    tx: CouponTx,
    input: {
      couponInstanceId: number
      userId: number
    },
  ) {
    const locks = this.buildCouponRedemptionLockRequests(input)
    await acquireIntegrityLocks(tx, locks)
    await this.assertUserExists(tx, input.userId)
  }

  /** 为券核销业务根构造券实例互斥锁与用户父记录共享锁。 */
  private buildCouponRedemptionLockRequests(input: {
    couponInstanceId: number
    userId: number
  }): IntegrityLockRequest[] {
    return [
      exclusiveIntegrityLock(
        tableIntegrityLock(
          getTableName(this.userCouponInstance),
          input.couponInstanceId,
        ),
      ),
      sharedIntegrityLock(
        tableIntegrityLock(
          getTableName(this.drizzle.schema.appUser),
          input.userId,
        ),
      ),
    ]
  }

  /** 锁后确认券实例所属用户仍然存在。 */
  private async assertUserExists(tx: DbExecutor, userId: number) {
    const [user] = await tx
      .select({ id: this.drizzle.schema.appUser.id })
      .from(this.drizzle.schema.appUser)
      .where(eq(this.drizzle.schema.appUser.id, userId))
      .limit(1)
    if (!user) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '用户不存在',
      )
    }
  }

  // 向用户发放指定券定义的券实例。
  async grantCoupon(dto: GrantCouponDto) {
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
    const lockRequests = [
      this.buildAdminGrantOperationLockRequest({
        operationId,
        userId: dto.userId,
      }),
      ...this.buildGrantParentLockRequests(grantInput),
    ]

    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.drizzle.withErrorHandling(async () =>
          acquireIntegrityLocks(tx, lockRequests),
        )
        await this.ensureAdminGrantOperationReplayCompatible(
          tx,
          grantInput,
          grantKeys,
          grantKeyPrefix,
        )
        await this.grantCouponsForSourceAfterLocks(tx, grantInput)
      },
    })
    return true
  }

  // 通用发券入口，支持数量、有效期覆盖和 grantKey 幂等。
  async grantCouponsForSourceAfterLocks(
    tx: CouponTx,
    input: GrantCouponsForSourceInput,
  ): Promise<GrantCouponsForSourceResult> {
    return tx.transaction(async (grantTx) => {
      const result = await this.grantCouponsForSourceInSavepointAfterLocks(
        grantTx,
        input,
      )
      return result
    })
  }

  /**
   * 将一批券实例的校验、插入和幂等回放收敛到同一个 savepoint。
   *
   * 批量工作流会在外层事务中捕获单个用户的失败并持久化 FAILED 状态；这里必须
   * 保证任何失败都会先回滚本批已经插入的券实例，不能让前一个分块随失败状态提交。
   */
  private async grantCouponsForSourceInSavepointAfterLocks(
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

    const definition: CouponGrantDefinitionSource | undefined =
      await tx.query.couponDefinition.findFirst({
        where: { id: input.couponDefinitionId, isEnabled: true },
        columns: this.couponGrantDefinitionColumns,
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
    let createdCount = 0
    const seenGrantKeys = new Set<string>()
    const hasGrantKeys = grantKeys.length > 0

    for (
      let offset = 0;
      offset < quantity;
      offset += COUPON_GRANT_INSERT_CHUNK_SIZE
    ) {
      const chunkLength = Math.min(
        COUPON_GRANT_INSERT_CHUNK_SIZE,
        quantity - offset,
      )
      const chunkGrantKeys: Array<string | null> = hasGrantKeys
        ? grantKeys.slice(offset, offset + chunkLength)
        : Array.from<string | null>({ length: chunkLength }).fill(null)
      if (!hasGrantKeys) {
        const insertRows = await this.insertCouponInstanceChunk(
          tx,
          input,
          definition,
          expiresAt,
          grantSnapshot,
          chunkGrantKeys,
        )
        if (insertRows.length !== chunkLength) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '发券幂等记录状态异常',
          )
        }
        createdCount += insertRows.length
        continue
      }

      const requestedGrantKeys = chunkGrantKeys.filter(
        (grantKey): grantKey is string => grantKey !== null,
      )
      const existingRows = await this.findCouponInstancesByGrantKeys(
        tx,
        input.userId,
        [...new Set(requestedGrantKeys)],
      )
      const existingByGrantKey = new Map<string, CouponGrantReplaySource>()
      for (const couponInstance of existingRows) {
        if (couponInstance.grantKey) {
          existingByGrantKey.set(couponInstance.grantKey, couponInstance)
        }
      }

      for (let index = 0; index < chunkGrantKeys.length; index += 1) {
        const grantKey = chunkGrantKeys[index]
        if (!grantKey) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '发券幂等记录状态异常',
          )
        }
        const existing = existingByGrantKey.get(grantKey)
        if (
          existing &&
          !this.isGrantKeyReplayCompatible(existing, input, grantKey)
        ) {
          this.assertGrantKeyReplayShape(existing, input, grantKey)
        }
      }

      const insertRows = await this.insertCouponInstanceChunk(
        tx,
        input,
        definition,
        expiresAt,
        grantSnapshot,
        chunkGrantKeys,
      )
      const insertedByGrantKey = new Map<string, CouponGrantReplaySource>()
      for (const couponInstance of insertRows) {
        if (!couponInstance.grantKey) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '发券幂等记录状态异常',
          )
        }
        insertedByGrantKey.set(couponInstance.grantKey, couponInstance)
      }

      const replayGrantKeys = [
        ...new Set(
          chunkGrantKeys.filter(
            (grantKey): grantKey is string =>
              grantKey !== null &&
              !insertedByGrantKey.has(grantKey) &&
              !existingByGrantKey.has(grantKey),
          ),
        ),
      ]
      const replayByGrantKey = new Map(existingByGrantKey)
      if (replayGrantKeys.length > 0) {
        const replayRows = await this.findCouponInstancesByGrantKeys(
          tx,
          input.userId,
          replayGrantKeys,
        )
        for (const couponInstance of replayRows) {
          if (couponInstance.grantKey) {
            replayByGrantKey.set(couponInstance.grantKey, couponInstance)
          }
        }
      }

      for (const grantKey of chunkGrantKeys) {
        if (!grantKey) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '发券幂等记录状态异常',
          )
        }
        const couponInstance =
          insertedByGrantKey.get(grantKey) ?? replayByGrantKey.get(grantKey)
        if (!couponInstance) {
          throw new BusinessException(
            BusinessErrorCode.STATE_CONFLICT,
            '发券幂等记录状态异常',
          )
        }
        const created =
          insertedByGrantKey.has(grantKey) && !seenGrantKeys.has(grantKey)
        if (!created) {
          this.assertGrantKeyReplayShape(couponInstance, input, grantKey)
        } else {
          createdCount += 1
        }
        seenGrantKeys.add(grantKey)
      }
    }

    return {
      createdCount,
    }
  }

  /**
   * 在已锁定并重查券定义、用户的同一 savepoint 中写入单个发券分块。
   * 保持事务参数显式，避免发券写入脱离父记录的锁与重查证据链。
   */
  private async insertCouponInstanceChunk(
    tx: CouponTx,
    input: Pick<
      GrantCouponsForSourceInput,
      'sourceId' | 'sourceType' | 'userId'
    >,
    definition: Pick<
      CouponDefinitionSelect,
      'couponType' | 'id' | 'usageLimit'
    >,
    expiresAt: Date | null,
    grantSnapshot: CouponGrantSnapshot,
    chunkGrantKeys: ReadonlyArray<string | null>,
  ) {
    return tx
      .insert(this.userCouponInstance)
      .values(
        chunkGrantKeys.map((grantKey) => ({
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
        })),
      )
      .onConflictDoNothing({
        target: [
          this.userCouponInstance.userId,
          this.userCouponInstance.grantKey,
        ],
        where: sql`${this.userCouponInstance.grantKey} is not null`,
      })
      .returning(this.couponGrantReplayProjection)
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

  private buildAdminGrantOperationLockRequest(input: {
    operationId: string
    userId: number
  }): IntegrityLockRequest {
    return exclusiveIntegrityLock(
      relationIntegrityLock(
        'coupon-admin-grant-operation',
        input.userId,
        input.operationId,
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
      .select(this.couponGrantReplayProjection)
      .from(this.userCouponInstance)
      .where(
        and(
          eq(this.userCouponInstance.userId, userId),
          sql`starts_with(${this.userCouponInstance.grantKey}, ${grantKeyPrefix})`,
        ),
      )
  }

  private async findCouponInstancesByGrantKeys(
    tx: CouponTx,
    userId: number,
    grantKeys: string[],
  ) {
    return tx
      .select(this.couponGrantReplayProjection)
      .from(this.userCouponInstance)
      .where(
        and(
          eq(this.userCouponInstance.userId, userId),
          inArray(this.userCouponInstance.grantKey, grantKeys),
        ),
      )
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
    if (!this.isGrantKeyReplayCompatible(existing, input, grantKey)) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '发券幂等键已被不同发券请求使用',
      )
    }
  }

  private isGrantKeyReplayCompatible(
    existing: {
      couponDefinitionId: number
      sourceType: number
      sourceId?: number | null
      grantKey?: string | null
    },
    input: GrantCouponsForSourceInput,
    grantKey: string,
  ) {
    const grantKeyMatches = !(
      existing.grantKey !== undefined &&
      existing.grantKey !== null &&
      existing.grantKey !== grantKey
    )
    const sourceMatches =
      existing.couponDefinitionId === input.couponDefinitionId &&
      existing.sourceType === input.sourceType &&
      (existing.sourceId ?? null) === (input.sourceId ?? null)
    return grantKeyMatches && sourceMatches
  }

  // 启用或停用券定义。
  async updateCouponDefinitionStatus(id: number, isEnabled: boolean) {
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.lockCouponDefinition(tx, id)
        await this.assertCouponDefinitionExistsForUpdate(tx, id)
        const updated = await tx
          .update(this.couponDefinition)
          .set({ isEnabled })
          .where(eq(this.couponDefinition.id, id))
          .returning({ id: this.couponDefinition.id })
        this.drizzle.assertAffectedRows(updated, '券定义不存在')
      },
    })
    return true
  }

  // 更新券定义。
  async updateCouponDefinition(dto: UpdateCouponDefinitionDto) {
    const { id, ...data } = dto
    await this.drizzle.withTransaction({
      execute: async (tx) => {
        await this.lockCouponDefinition(tx, id)
        const existing = await this.readCouponDefinitionForUpdate(tx, id)
        const normalizedData = this.normalizeCouponDefinitionUpdate(
          data,
          existing,
        )
        const updated = await tx
          .update(this.couponDefinition)
          .set(normalizedData)
          .where(eq(this.couponDefinition.id, id))
          .returning({ id: this.couponDefinition.id })
        this.drizzle.assertAffectedRows(updated, '券定义不存在')
      },
    })
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
    data: CouponDefinitionUpdateInput,
    existing: CouponDefinitionUpdateSource,
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
        .select(this.couponDefinitionPageSelect)
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
    coupon: CouponDefinitionPageRow,
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

  /** 购买事务外读取折扣券事实并构造券实例、用户的完整锁请求。 */
  async prepareDiscountCouponReservation(
    input: ReserveDiscountCouponInput,
  ): Promise<PreparedDiscountCouponReservation> {
    const coupon = await this.getCouponInstanceWithDefinition(this.db, {
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

    const pricing = this.calculateDiscountCouponPricing(
      input.originalPrice,
      coupon,
    )
    return {
      coupon,
      ...pricing,
      lockRequests: this.buildCouponRedemptionLockRequests(input),
    }
  }

  /**
   * 在购买根已取得完整锁并集后权威重读、校验并预留折扣券。
   * 快照漂移只返回闭集状态，由购买根回滚当前事务并开启一次全新重试。
   */
  async reserveDiscountCouponAfterLocks(
    tx: CouponTx,
    input: ReserveDiscountCouponInput,
    prepared: PreparedDiscountCouponReservation,
  ): Promise<DiscountCouponReservationApplyResult> {
    const coupon = await this.findCouponInstanceWithDefinition(tx, {
      userId: input.userId,
      couponInstanceId: input.couponInstanceId,
    })
    if (
      !coupon ||
      !this.isSameCouponReservationSnapshot(coupon, prepared.coupon)
    ) {
      return { status: 'snapshot_drift' }
    }

    await this.assertUserExists(tx, input.userId)
    this.assertCouponNotExpired(coupon)
    this.assertSnapshotCouponType(coupon)
    if (coupon.couponType !== CouponTypeEnum.DISCOUNT) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '只有折扣券可以参与章节购买价格计算',
      )
    }

    const pricing = this.calculateDiscountCouponPricing(
      input.originalPrice,
      coupon,
    )
    const bizKey = `discount:${input.userId}:${input.targetType}:${input.targetId}:${input.couponInstanceId}`

    const { redemption } = await this.consumeCouponAndWriteRedemption(tx, {
      ...input,
      coupon,
      bizKey,
      redemptionSnapshot: {
        originalPrice: input.originalPrice,
        paidPrice: pricing.paidPrice,
        discountAmount: pricing.discountAmount,
        discountRateBps: coupon.discountRateBps,
      },
    })

    return {
      status: 'applied',
      reservation: {
        ...pricing,
        couponInstanceId: input.couponInstanceId,
        redemptionRecordId: redemption.id,
        discountSource: CouponTypeEnum.DISCOUNT,
      },
    }
  }

  /** 按券发放快照计算折扣价格，事务外发现与锁后应用共用同一公式。 */
  private calculateDiscountCouponPricing(
    originalPrice: number,
    coupon: Pick<
      CouponInstanceWithDefinition,
      'discountAmount' | 'discountRateBps'
    >,
  ) {
    const discountedByRate = Math.floor(
      (originalPrice * coupon.discountRateBps) / 10000,
    )
    const paidPrice = Math.max(0, discountedByRate - coupon.discountAmount)
    return {
      paidPrice,
      discountAmount: originalPrice - paidPrice,
    }
  }

  /** 比较购买计价与核销实际消费的完整券实例快照。 */
  private isSameCouponReservationSnapshot(
    actual: CouponInstanceWithDefinition,
    expected: CouponInstanceWithDefinition,
  ) {
    return (
      actual.id === expected.id &&
      actual.userId === expected.userId &&
      actual.couponDefinitionId === expected.couponDefinitionId &&
      actual.couponType === expected.couponType &&
      actual.status === expected.status &&
      actual.remainingUses === expected.remainingUses &&
      (actual.expiresAt?.getTime() ?? null) ===
        (expected.expiresAt?.getTime() ?? null) &&
      JSON.stringify(actual.grantSnapshot) ===
        JSON.stringify(expected.grantSnapshot)
    )
  }

  // 扣减券可用次数并写入幂等核销记录，返回 created 控制后续副作用。
  private async consumeCouponAndWriteRedemption(
    tx: CouponTx,
    input: ConsumeCouponRedemptionInput,
  ): Promise<CouponRedemptionConsumeResult> {
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
      .returning(this.couponRedemptionResultProjection)

    if (!insertedRedemption) {
      const existing = await tx.query.couponRedemptionRecord.findFirst({
        where: {
          userId: input.userId,
          bizKey: input.bizKey,
        },
        columns: this.couponRedemptionResultColumns,
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

  /** 查询并校验当前可核销的用户券实例及其冻结定义快照。 */
  private async getCouponInstanceWithDefinition(
    runner: DbExecutor,
    input: CouponInstanceLookupInput,
  ): Promise<CouponInstanceWithDefinition> {
    const coupon = await this.findCouponInstanceWithDefinition(runner, input)
    if (!coupon) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '可用券不存在',
      )
    }
    this.assertCouponNotExpired(coupon)
    return coupon
  }

  /** 读取锁前或锁后的券实例原始可用事实；缺失由调用方决定错误或漂移语义。 */
  private async findCouponInstanceWithDefinition(
    runner: DbExecutor,
    input: CouponInstanceLookupInput,
  ): Promise<CouponInstanceWithDefinition | undefined> {
    const rows = await runner
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
        targetScope:
          sql<number>`(${this.userCouponInstance.grantSnapshot}->>'targetScope')::int`.mapWith(
            Number,
          ),
        discountAmount:
          sql<number>`(${this.userCouponInstance.grantSnapshot}->>'discountAmount')::int`.mapWith(
            Number,
          ),
        discountRateBps:
          sql<number>`(${this.userCouponInstance.grantSnapshot}->>'discountRateBps')::int`.mapWith(
            Number,
          ),
        validDays:
          sql<number>`(${this.userCouponInstance.grantSnapshot}->>'validDays')::int`.mapWith(
            Number,
          ),
        benefitDays:
          sql<number>`(${this.userCouponInstance.grantSnapshot}->>'benefitDays')::int`.mapWith(
            Number,
          ),
        benefitCount:
          sql<number>`(${this.userCouponInstance.grantSnapshot}->>'benefitCount')::int`.mapWith(
            Number,
          ),
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
      return undefined
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

  /** 对事务外发现与锁后权威重读共用同一过期语义。 */
  private assertCouponNotExpired(
    coupon: Pick<CouponInstanceWithDefinition, 'expiresAt'>,
  ) {
    if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '券已过期',
      )
    }
  }

  // 核销用户券并在同一事务中执行对应权益发放。
  async redeemCoupon(dto: RedeemCouponCommandDto) {
    return this.drizzle.withTransaction({
      execute: async (tx) => {
        const redemption = await this.redeemCouponInTx(tx, dto)
        return this.toCouponRedemptionResultDto(redemption)
      },
    })
  }

  // 在外部事务中核销券，并仅在首次核销时执行权益发放副作用。
  private async redeemCouponInTx(tx: CouponTx, dto: RedeemCouponCommandDto) {
    await this.lockCouponInstanceAndUserForRedemption(tx, dto)
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
        ? this.requireReadingChapterTargetType(dto.targetType)
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
      await this.couponContentPort.grantReadingEntitlement(tx, {
        userId: dto.userId,
        targetType: readingTargetType,
        targetId: this.requireTargetId(dto.targetId, '阅读券核销目标不能为空'),
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

  // 阅读券仅支持章节目标，先在券域拒绝其他核销目标以保持当前错误语义。
  private requireReadingChapterTargetType(
    targetType: CouponRedemptionTargetTypeEnum,
  ) {
    if (targetType === CouponRedemptionTargetTypeEnum.COMIC_CHAPTER) {
      return targetType
    }
    if (targetType === CouponRedemptionTargetTypeEnum.NOVEL_CHAPTER) {
      return targetType
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
