import type { Db, DbExecutor } from '@db/core'
import type { CheckInMakeupAccountSelect } from '@db/schema'
import type { CheckInConfigRuntimeRow } from './check-in.service.support'
import type {
  CheckInMakeupAccountBalance,
  CheckInMakeupAccountView,
  CheckInMakeupConsumePlanItem,
  CheckInMakeupWindowView,
  GrantEventMakeupAllowanceInput,
  GrantEventMakeupAllowanceResult,
} from './check-in.type'
import { DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger/growth-ledger.service'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import {
  addDaysToDateOnlyInAppTimeZone,
  endOfDayInAppTimeZone,
  getDateOnlyPartsInAppTimeZone,
  parseDateOnlyInAppTimeZone,
} from '@libs/platform/utils'
import { BadRequestException, Injectable } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import {
  CheckInMakeupFactTypeEnum,
  CheckInMakeupPeriodTypeEnum,
  CheckInMakeupSourceTypeEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

type CheckInMakeupConfig = Pick<
  CheckInConfigRuntimeRow,
  'makeupPeriodType' | 'periodicAllowance'
>

type CheckInMakeupAccountViewRow = Pick<
  CheckInMakeupAccountSelect,
  'periodicGranted' | 'periodicUsed' | 'eventAvailable'
>

type CheckInMakeupLatestAccountViewRow = Pick<
  CheckInMakeupAccountSelect,
  'eventAvailable'
>

type CheckInMakeupAccountMutationRow = Pick<
  CheckInMakeupAccountSelect,
  | 'id'
  | 'userId'
  | 'periodType'
  | 'periodKey'
  | 'periodicGranted'
  | 'periodicUsed'
  | 'eventAvailable'
  | 'version'
  | 'lastSyncedFactId'
>

type CheckInMakeupAccountRolloverRow = Pick<
  CheckInMakeupAccountSelect,
  | 'periodType'
  | 'periodKey'
  | 'periodicGranted'
  | 'periodicUsed'
  | 'eventAvailable'
>

/**
 * 签到补签额度服务。
 *
 * 负责补签窗口、补签账户初始化、额度同步和额度消费计划。
 */
@Injectable()
export class CheckInMakeupService extends CheckInServiceSupport {
  // 注入补签额度服务所需的底层数据库和账本依赖。
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
  ) {
    super(drizzle, growthLedgerService)
  }

  // 按补签周期类型计算某个自然日所在的周期窗口。
  buildMakeupWindow(
    date: string,
    periodType: CheckInMakeupPeriodTypeEnum,
  ): CheckInMakeupWindowView {
    const dateParts = getDateOnlyPartsInAppTimeZone(date)
    if (!dateParts) {
      throw new BadRequestException('日期非法')
    }

    if (periodType === CheckInMakeupPeriodTypeEnum.WEEKLY) {
      const periodStartDate = addDaysToDateOnlyInAppTimeZone(
        date,
        -(dateParts.weekday - 1),
      )!
      const periodEndDate = addDaysToDateOnlyInAppTimeZone(periodStartDate, 6)!
      return {
        periodType,
        periodKey: `week-${periodStartDate}`,
        periodStartDate,
        periodEndDate,
      }
    }

    return {
      periodType,
      periodKey: `month-${dateParts.monthStartDate}`,
      periodStartDate: dateParts.monthStartDate,
      periodEndDate: dateParts.monthEndDate,
    }
  }

  // 判断目标签到日期是否仍位于当前补签窗口内。
  isDateWithinMakeupWindow(signDate: string, window: CheckInMakeupWindowView) {
    return (
      signDate >= window.periodStartDate && signDate <= window.periodEndDate
    )
  }

  // 构建当前周期的补签账户读模型，不存在账户时回退到默认视图。
  async buildCurrentMakeupAccountView(
    userId: number,
    config: CheckInMakeupConfig,
    today = this.formatDateOnly(new Date()),
    db: Db = this.db,
  ): Promise<CheckInMakeupAccountView> {
    const periodType = Number(config.makeupPeriodType)
    const window = this.buildMakeupWindow(today, periodType)
    const currentAccount = await this.getCurrentMakeupAccountView(
      userId,
      window.periodType,
      window.periodKey,
      db,
    )
    if (currentAccount) {
      return {
        ...window,
        periodicGranted: currentAccount.periodicGranted,
        periodicUsed: currentAccount.periodicUsed,
        periodicRemaining: Math.max(
          currentAccount.periodicGranted - currentAccount.periodicUsed,
          0,
        ),
        eventAvailable: currentAccount.eventAvailable,
      }
    }

    const latestAccount = await this.getLatestMakeupAccountView(userId, db)
    return {
      ...window,
      periodicGranted: config.periodicAllowance,
      periodicUsed: 0,
      periodicRemaining: config.periodicAllowance,
      eventAvailable: latestAccount?.eventAvailable ?? 0,
    }
  }

  // 确保当前周期补签账户存在，并在跨周期时完成滚动初始化。
  async ensureCurrentMakeupAccount(
    userId: number,
    config: CheckInMakeupConfig,
    today: string,
    tx: DbExecutor,
  ): Promise<CheckInMakeupAccountMutationRow> {
    const periodType = Number(config.makeupPeriodType)
    const window = this.buildMakeupWindow(today, periodType)
    const existing = await this.getCurrentMakeupAccountForMutation(
      userId,
      window.periodType,
      window.periodKey,
      tx,
    )
    if (existing) {
      return existing
    }

    const previous = await this.getLatestMakeupAccountForRollover(userId, tx)
    if (previous && previous.periodKey !== window.periodKey) {
      const periodicRemaining = Math.max(
        previous.periodicGranted - previous.periodicUsed,
        0,
      )
      const periodStartAt = parseDateOnlyInAppTimeZone(window.periodStartDate)!
      if (periodicRemaining > 0) {
        await tx
          .insert(this.checkInMakeupFactTable)
          .values({
            userId,
            factType: CheckInMakeupFactTypeEnum.EXPIRE,
            sourceType: CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE,
            amount: 0,
            consumedAmount: periodicRemaining,
            effectiveAt: periodStartAt,
            expiresAt: periodStartAt,
            periodType: previous.periodType,
            periodKey: previous.periodKey,
            sourceRef: null,
            bizKey: `checkin:makeup:expire:user:${userId}:period:${previous.periodKey}`,
            context: { source: 'period_rollover' },
          })
          .onConflictDoNothing({
            target: [
              this.checkInMakeupFactTable.userId,
              this.checkInMakeupFactTable.bizKey,
            ],
          })
      }
    }

    const periodStartAt = parseDateOnlyInAppTimeZone(window.periodStartDate)!
    const periodEndAt = endOfDayInAppTimeZone(
      parseDateOnlyInAppTimeZone(window.periodEndDate)!,
    )
    const grantedFactRows = await tx
      .insert(this.checkInMakeupFactTable)
      .values({
        userId,
        factType: CheckInMakeupFactTypeEnum.GRANT,
        sourceType: CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE,
        amount: config.periodicAllowance,
        consumedAmount: 0,
        effectiveAt: periodStartAt,
        expiresAt: periodEndAt,
        periodType: window.periodType,
        periodKey: window.periodKey,
        sourceRef: null,
        bizKey: `checkin:makeup:grant:user:${userId}:period:${window.periodKey}`,
        context: { source: 'periodic_allowance' },
      })
      .onConflictDoNothing({
        target: [
          this.checkInMakeupFactTable.userId,
          this.checkInMakeupFactTable.bizKey,
        ],
      })
      .returning({ id: this.checkInMakeupFactTable.id })

    const [account] = await tx
      .insert(this.checkInMakeupAccountTable)
      .values({
        userId,
        periodType: window.periodType,
        periodKey: window.periodKey,
        periodicGranted: config.periodicAllowance,
        periodicUsed: 0,
        eventAvailable: previous?.eventAvailable ?? 0,
        version: 0,
        lastSyncedFactId: grantedFactRows[0]?.id ?? null,
      })
      .onConflictDoNothing({
        target: [
          this.checkInMakeupAccountTable.userId,
          this.checkInMakeupAccountTable.periodType,
          this.checkInMakeupAccountTable.periodKey,
        ],
      })
      .returning(this.buildCurrentMakeupAccountMutationSelect())
    if (account) {
      return account
    }

    const concurrent = await this.getCurrentMakeupAccountForMutation(
      userId,
      window.periodType,
      window.periodKey,
      tx,
    )
    if (!concurrent) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '补签账户初始化冲突，请稍后重试',
      )
    }
    return concurrent
  }

  // 根据当前账户余额决定本次补签应消费哪类额度。
  buildMakeupConsumePlan(
    account: CheckInMakeupAccountBalance,
  ): CheckInMakeupConsumePlanItem[] {
    const periodicRemaining = Math.max(
      account.periodicGranted - account.periodicUsed,
      0,
    )
    if (periodicRemaining > 0) {
      return [
        {
          sourceType: CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE,
          amount: 1,
        },
      ]
    }

    if (account.eventAvailable > 0) {
      return [
        {
          sourceType: CheckInMakeupSourceTypeEnum.EVENT_CARD,
          amount: 1,
        },
      ]
    }

    throw new BusinessException(
      BusinessErrorCode.QUOTA_NOT_ENOUGH,
      '当前无可用补签额度',
    )
  }

  // 在事务内写入补签消费事实并乐观更新当前账户。
  async consumeMakeupAllowance(
    account: CheckInMakeupAccountMutationRow,
    consumePlan: CheckInMakeupConsumePlanItem[],
    tx: DbExecutor,
  ) {
    let periodicUsed = account.periodicUsed
    let eventAvailable = account.eventAvailable
    let lastFactId: number | null = account.lastSyncedFactId ?? null

    for (const item of consumePlan) {
      const factRows = await tx
        .insert(this.checkInMakeupFactTable)
        .values({
          userId: account.userId,
          factType: CheckInMakeupFactTypeEnum.CONSUME,
          sourceType: item.sourceType,
          amount: 0,
          consumedAmount: item.amount,
          effectiveAt: new Date(),
          expiresAt: null,
          periodType: account.periodType,
          periodKey: account.periodKey,
          sourceRef: null,
          bizKey: `checkin:makeup:consume:user:${account.userId}:account:${account.id}:version:${account.version + 1}:${item.sourceType}`,
          context: { source: 'makeup_sign' },
        })
        .returning({ id: this.checkInMakeupFactTable.id })

      lastFactId = factRows[0]?.id ?? lastFactId
      if (item.sourceType === CheckInMakeupSourceTypeEnum.PERIODIC_ALLOWANCE) {
        periodicUsed += item.amount
      } else if (item.sourceType === CheckInMakeupSourceTypeEnum.EVENT_CARD) {
        eventAvailable -= item.amount
      }
    }

    const [nextAccount] = await tx
      .update(this.checkInMakeupAccountTable)
      .set({
        periodicUsed,
        eventAvailable,
        version: account.version + 1,
        lastSyncedFactId: lastFactId,
      })
      .where(
        and(
          eq(this.checkInMakeupAccountTable.id, account.id),
          eq(this.checkInMakeupAccountTable.version, account.version),
        ),
      )
      .returning()
    if (!nextAccount) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '补签额度账户并发冲突，请稍后重试',
      )
    }
    return nextAccount
  }

  // 在外部事务内发放活动补签卡额度，并同步当前周期补签账户。
  async grantEventMakeupAllowance(
    tx: DbExecutor,
    input: GrantEventMakeupAllowanceInput,
  ): Promise<GrantEventMakeupAllowanceResult> {
    if (!Number.isInteger(input.amount) || input.amount < 1) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '补签次数必须为正整数',
      )
    }
    const bizKey = input.bizKey.trim()
    if (!bizKey) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '补签卡发放幂等键不能为空',
      )
    }

    await this.ensureUserExists(input.userId, tx)
    const config = await this.getEnabledConfig(tx)
    const today = this.formatDateOnly(new Date())
    const account = await this.ensureCurrentMakeupAccount(
      input.userId,
      config,
      today,
      tx,
    )
    const window = this.buildMakeupWindow(today, config.makeupPeriodType)

    const [fact] = await tx
      .insert(this.checkInMakeupFactTable)
      .values({
        userId: input.userId,
        factType: CheckInMakeupFactTypeEnum.GRANT,
        sourceType: CheckInMakeupSourceTypeEnum.EVENT_CARD,
        amount: input.amount,
        consumedAmount: 0,
        effectiveAt: new Date(),
        expiresAt: null,
        periodType: window.periodType,
        periodKey: window.periodKey,
        sourceRef: input.sourceRef ?? null,
        bizKey,
        context: input.context ?? null,
      })
      .onConflictDoNothing({
        target: [
          this.checkInMakeupFactTable.userId,
          this.checkInMakeupFactTable.bizKey,
        ],
      })
      .returning({ id: this.checkInMakeupFactTable.id })

    if (!fact) {
      const resultAccount = await this.getCurrentMakeupAccountForResult(
        input.userId,
        account.periodType,
        account.periodKey,
        tx,
      )
      if (!resultAccount) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '补签账户初始化冲突，请稍后重试',
        )
      }
      return {
        account: resultAccount,
        created: false,
        factId: null,
      }
    }

    const [nextAccount] = await tx
      .update(this.checkInMakeupAccountTable)
      .set({
        eventAvailable: account.eventAvailable + input.amount,
        version: account.version + 1,
        lastSyncedFactId: fact.id,
      })
      .where(
        and(
          eq(this.checkInMakeupAccountTable.id, account.id),
          eq(this.checkInMakeupAccountTable.version, account.version),
        ),
      )
      .returning()
    if (!nextAccount) {
      throw new BusinessException(
        BusinessErrorCode.STATE_CONFLICT,
        '补签额度账户并发冲突，请稍后重试',
      )
    }
    return {
      account: nextAccount,
      created: true,
      factId: fact.id,
    }
  }

  // 读取视图只关心最近账户的活动补签卡余额。
  private async getLatestMakeupAccountView(
    userId: number,
    db: Db = this.db,
  ): Promise<CheckInMakeupLatestAccountViewRow | undefined> {
    const [account] = await db
      .select({ eventAvailable: this.checkInMakeupAccountTable.eventAvailable })
      .from(this.checkInMakeupAccountTable)
      .where(eq(this.checkInMakeupAccountTable.userId, userId))
      .orderBy(desc(this.checkInMakeupAccountTable.id))
      .limit(1)
    return account
  }

  // 当前补签摘要只读取余额视图字段。
  private async getCurrentMakeupAccountView(
    userId: number,
    periodType: CheckInMakeupPeriodTypeEnum,
    periodKey: string,
    db: Db = this.db,
  ): Promise<CheckInMakeupAccountViewRow | undefined> {
    const [account] = await db
      .select(this.buildCurrentMakeupAccountViewSelect())
      .from(this.checkInMakeupAccountTable)
      .where(
        and(
          eq(this.checkInMakeupAccountTable.userId, userId),
          eq(this.checkInMakeupAccountTable.periodType, periodType),
          eq(this.checkInMakeupAccountTable.periodKey, periodKey),
        ),
      )
      .limit(1)
    return account
  }

  // 写入链需要账户定位、余额、版本与事实同步点。
  private async getCurrentMakeupAccountForMutation(
    userId: number,
    periodType: CheckInMakeupPeriodTypeEnum,
    periodKey: string,
    db: Db = this.db,
  ): Promise<CheckInMakeupAccountMutationRow | undefined> {
    const [account] = await db
      .select(this.buildCurrentMakeupAccountMutationSelect())
      .from(this.checkInMakeupAccountTable)
      .where(
        and(
          eq(this.checkInMakeupAccountTable.userId, userId),
          eq(this.checkInMakeupAccountTable.periodType, periodType),
          eq(this.checkInMakeupAccountTable.periodKey, periodKey),
        ),
      )
      .limit(1)
    return account
  }

  // 跨周期滚动只读取过期计算和新周期继承所需的余额字段。
  private async getLatestMakeupAccountForRollover(
    userId: number,
    db: Db = this.db,
  ): Promise<CheckInMakeupAccountRolloverRow | undefined> {
    const [account] = await db
      .select(this.buildLatestMakeupAccountRolloverSelect())
      .from(this.checkInMakeupAccountTable)
      .where(eq(this.checkInMakeupAccountTable.userId, userId))
      .orderBy(desc(this.checkInMakeupAccountTable.id))
      .limit(1)
    return account
  }

  // 幂等活动补签卡发放保持既有完整账户返回结构。
  private async getCurrentMakeupAccountForResult(
    userId: number,
    periodType: CheckInMakeupPeriodTypeEnum,
    periodKey: string,
    db: Db = this.db,
  ): Promise<CheckInMakeupAccountSelect | undefined> {
    const [account] = await db
      .select(this.buildCurrentMakeupAccountResultSelect())
      .from(this.checkInMakeupAccountTable)
      .where(
        and(
          eq(this.checkInMakeupAccountTable.userId, userId),
          eq(this.checkInMakeupAccountTable.periodType, periodType),
          eq(this.checkInMakeupAccountTable.periodKey, periodKey),
        ),
      )
      .limit(1)
    return account
  }

  private buildCurrentMakeupAccountViewSelect() {
    return {
      periodicGranted: this.checkInMakeupAccountTable.periodicGranted,
      periodicUsed: this.checkInMakeupAccountTable.periodicUsed,
      eventAvailable: this.checkInMakeupAccountTable.eventAvailable,
    } as const
  }

  private buildCurrentMakeupAccountMutationSelect() {
    return {
      id: this.checkInMakeupAccountTable.id,
      userId: this.checkInMakeupAccountTable.userId,
      periodType: this.checkInMakeupAccountTable.periodType,
      periodKey: this.checkInMakeupAccountTable.periodKey,
      periodicGranted: this.checkInMakeupAccountTable.periodicGranted,
      periodicUsed: this.checkInMakeupAccountTable.periodicUsed,
      eventAvailable: this.checkInMakeupAccountTable.eventAvailable,
      version: this.checkInMakeupAccountTable.version,
      lastSyncedFactId: this.checkInMakeupAccountTable.lastSyncedFactId,
    } as const
  }

  private buildLatestMakeupAccountRolloverSelect() {
    return {
      periodType: this.checkInMakeupAccountTable.periodType,
      periodKey: this.checkInMakeupAccountTable.periodKey,
      periodicGranted: this.checkInMakeupAccountTable.periodicGranted,
      periodicUsed: this.checkInMakeupAccountTable.periodicUsed,
      eventAvailable: this.checkInMakeupAccountTable.eventAvailable,
    } as const
  }

  private buildCurrentMakeupAccountResultSelect() {
    return {
      id: this.checkInMakeupAccountTable.id,
      userId: this.checkInMakeupAccountTable.userId,
      periodType: this.checkInMakeupAccountTable.periodType,
      periodKey: this.checkInMakeupAccountTable.periodKey,
      periodicGranted: this.checkInMakeupAccountTable.periodicGranted,
      periodicUsed: this.checkInMakeupAccountTable.periodicUsed,
      eventAvailable: this.checkInMakeupAccountTable.eventAvailable,
      version: this.checkInMakeupAccountTable.version,
      lastSyncedFactId: this.checkInMakeupAccountTable.lastSyncedFactId,
      createdAt: this.checkInMakeupAccountTable.createdAt,
      updatedAt: this.checkInMakeupAccountTable.updatedAt,
    } as const
  }
}
