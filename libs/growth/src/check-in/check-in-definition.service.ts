import type { IdDto } from '@libs/platform/dto'
import type {
  CheckInStreakRewardRuleInput,
} from './check-in.type'
import type {
  CreateCheckInPlanDto,
  QueryCheckInPlanDto,
  UpdateCheckInPlanDto,
  UpdateCheckInPlanStatusDto,
} from './dto/check-in-definition.dto'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { GrowthLedgerService } from '@libs/growth/growth-ledger'
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import {
  CheckInPlanStatusEnum,
  CheckInRewardStatusEnum,
} from './check-in.constant'
import { CheckInServiceSupport } from './check-in.service.support'

/**
 * 签到定义服务。
 *
 * 负责任务模板式的配置层能力，包括计划创建、更新、状态流转与后台读模型。
 */
@Injectable()
export class CheckInDefinitionService extends CheckInServiceSupport {
  constructor(
    drizzle: DrizzleService,
    growthLedgerService: GrowthLedgerService,
  ) {
    super(drizzle, growthLedgerService)
  }

  /**
   * 分页读取签到计划列表，并补齐规则数、活跃周期数和待补偿奖励数摘要。
   */
  async getPlanPage(query: QueryCheckInPlanDto) {
    const conditions = [
      isNull(this.checkInPlanTable.deletedAt),
      buildILikeCondition(this.checkInPlanTable.planCode, query.planCode),
      buildILikeCondition(this.checkInPlanTable.planName, query.planName),
    ]
    if (query.status !== undefined) {
      conditions.push(eq(this.checkInPlanTable.status, query.status))
    }

    const page = await this.drizzle.ext.findPagination(this.checkInPlanTable, {
      where: and(...conditions),
      ...query,
      orderBy: query.orderBy?.trim()
        ? query.orderBy
        : { updatedAt: 'desc', id: 'desc' },
    })

    const summaries = await Promise.all(
      page.list.map(async (plan) =>
        this.buildPlanSummary(plan.id, plan.version),
      ),
    )

    return {
      ...page,
      list: page.list.map((plan, index) => {
        return {
          ...plan,
          status: this.resolvePlanStatus(plan),
          ...summaries[index],
        }
      }),
    }
  }

  /** 读取单个签到计划详情及当前版本规则快照。 */
  async getPlanDetail(query: IdDto) {
    const plan = await this.getPlanById(query.id)
    const [rules, summary] = await Promise.all([
      this.getPlanRules(plan.id, plan.version),
      this.buildPlanSummary(plan.id, plan.version),
    ])

    return {
      ...plan,
      status: this.resolvePlanStatus(plan),
      ...summary,
      streakRewardRules: rules.map((rule) => this.toStreakRuleView(rule)),
    }
  }

  /**
   * 创建签到计划。
   *
   * 会在写入前校验补签额度、计划起止日期以及“当前只允许一个生效计划”的运营约束。
   */
  async createPlan(dto: CreateCheckInPlanDto, adminUserId: number) {
    const cycleType = this.parseCycleType(dto.cycleType)
    const startDate = this.parseDateOnly(dto.startDate, '计划开始日期')
    const endDate = dto.endDate
      ? this.parseDateOnly(dto.endDate, '计划结束日期')
      : null
    const allowMakeupCountPerCycle = dto.allowMakeupCountPerCycle ?? 0
    if (
      !Number.isInteger(allowMakeupCountPerCycle) ||
      allowMakeupCountPerCycle < 0
    ) {
      throw new BadRequestException('每周期补签次数必须为非负整数')
    }
    this.ensurePlanDateRange(startDate, endDate)
    const baseRewardConfig = this.parseRewardConfig(dto.baseRewardConfig, {
      allowEmpty: true,
    })
    const now = new Date()
    if (
      this.isPlanActiveAt(
        {
          status: dto.status,
          startDate,
          endDate,
        },
        now,
      )
    ) {
      const activePlan = await this.findCurrentActivePlan(now)
      if (activePlan) {
        throw new ConflictException('当前已有其他生效中的签到计划')
      }
    }

    await this.drizzle.withTransaction(
      async (tx) => {
        const [plan] = await tx
          .insert(this.checkInPlanTable)
          .values({
            planCode: dto.planCode.trim(),
            planName: dto.planName.trim(),
            ...this.buildPlanStatusPersistence(dto.status),
            cycleType,
            startDate,
            endDate,
            allowMakeupCountPerCycle,
            baseRewardConfig,
            version: 1,
            createdById: adminUserId,
            updatedById: adminUserId,
          })
          .returning()

        const streakRewardRules = this.normalizeStreakRewardRules(
          dto.streakRewardRules,
          plan.id,
          plan.version,
        )
        if (streakRewardRules.length > 0) {
          await tx
            .insert(this.checkInStreakRewardRuleTable)
            .values(streakRewardRules)
        }
      },
      { duplicate: '签到计划编码已存在' },
    )

    return true
  }

  /**
   * 更新签到计划。
   *
   * 当改动会影响周期解释、补签规则或奖励语义时，自动递增版本并写入新版本规则。
   */
  async updatePlan(dto: UpdateCheckInPlanDto, adminUserId: number) {
    const currentPlan = await this.getPlanById(dto.id)
    const currentStatus = this.resolvePlanStatus(currentPlan)
    const nextPlan = {
      planCode: dto.planCode?.trim() ?? currentPlan.planCode,
      planName: dto.planName?.trim() ?? currentPlan.planName,
      status: dto.status ?? currentStatus,
      cycleType:
        dto.cycleType !== undefined
          ? this.parseCycleType(dto.cycleType)
          : this.parseCycleType(currentPlan.cycleType),
      startDate:
        dto.startDate !== undefined
          ? this.parseDateOnly(dto.startDate, '计划开始日期')
          : this.toDateOnlyValue(currentPlan.startDate),
      endDate:
        dto.endDate !== undefined
          ? dto.endDate
            ? this.parseDateOnly(dto.endDate, '计划结束日期')
            : null
          : this.toDateOnlyValue(currentPlan.endDate) || null,
      allowMakeupCountPerCycle:
        dto.allowMakeupCountPerCycle !== undefined
          ? dto.allowMakeupCountPerCycle
          : currentPlan.allowMakeupCountPerCycle,
      baseRewardConfig:
        dto.baseRewardConfig !== undefined
          ? this.parseRewardConfig(dto.baseRewardConfig, { allowEmpty: true })
          : this.parseStoredRewardConfig(currentPlan.baseRewardConfig, {
              allowEmpty: true,
            }),
    }

    if (
      !Number.isInteger(nextPlan.allowMakeupCountPerCycle) ||
      nextPlan.allowMakeupCountPerCycle < 0
    ) {
      throw new BadRequestException('每周期补签次数必须为非负整数')
    }
    this.ensurePlanDateRange(nextPlan.startDate, nextPlan.endDate)

    const currentRules = await this.getPlanRules(
      currentPlan.id,
      currentPlan.version,
    )
    const nextRuleInputs: CheckInStreakRewardRuleInput[] =
      dto.streakRewardRules ??
      currentRules.map((rule) => ({
        ruleCode: rule.ruleCode,
        streakDays: rule.streakDays,
        rewardConfig: this.parseStoredRewardConfig(rule.rewardConfig, {
          allowEmpty: false,
        })!,
        repeatable: rule.repeatable,
        status: rule.status,
      }))
    const nextRules = this.normalizeStreakRewardRules(
      nextRuleInputs,
      currentPlan.id,
      currentPlan.version,
    )

    const shouldBumpVersion = this.shouldBumpPlanVersion({
      currentPlan,
      nextPlan,
      currentRules,
      nextRules,
    })
    const nextVersion = shouldBumpVersion
      ? currentPlan.version + 1
      : currentPlan.version

    await this.drizzle.withTransaction(
      async (tx) => {
        const result = await tx
          .update(this.checkInPlanTable)
          .set({
            planCode: nextPlan.planCode,
            planName: nextPlan.planName,
            ...this.buildPlanStatusPersistence(nextPlan.status),
            cycleType: nextPlan.cycleType,
            startDate: nextPlan.startDate,
            endDate: nextPlan.endDate,
            allowMakeupCountPerCycle: nextPlan.allowMakeupCountPerCycle,
            baseRewardConfig: nextPlan.baseRewardConfig,
            version: nextVersion,
            updatedById: adminUserId,
          })
          .where(
            and(
              eq(this.checkInPlanTable.id, dto.id),
              isNull(this.checkInPlanTable.deletedAt),
            ),
          )

        this.drizzle.assertAffectedRows(result, '签到计划不存在')

        if (shouldBumpVersion && nextRules.length > 0) {
          await tx.insert(this.checkInStreakRewardRuleTable).values(
            nextRules.map((rule) => ({
              ...rule,
              planVersion: nextVersion,
            })),
          )
        }
      },
      { duplicate: '签到计划编码已存在' },
    )

    return true
  }

  /** 更新计划状态，并拦截会破坏单生效计划合同的配置。 */
  async updatePlanStatus(
    dto: UpdateCheckInPlanStatusDto,
    adminUserId: number,
  ) {
    const plan = await this.getPlanById(dto.id)
    const nextStatus = dto.status ?? this.resolvePlanStatus(plan)

    if (
      nextStatus === CheckInPlanStatusEnum.PUBLISHED &&
      this.isPlanActiveAt(
        {
          status: nextStatus,
          startDate: plan.startDate,
          endDate: plan.endDate,
        },
        new Date(),
      )
    ) {
      await this.assertNoOtherCurrentActivePlan(plan.id)
    }

    const result = await this.drizzle.withErrorHandling(() =>
      this.db
        .update(this.checkInPlanTable)
        .set({
          ...this.buildPlanStatusPersistence(nextStatus),
          updatedById: adminUserId,
        })
        .where(
          and(
            eq(this.checkInPlanTable.id, dto.id),
            isNull(this.checkInPlanTable.deletedAt),
          ),
        ),
    )

    this.drizzle.assertAffectedRows(result, '签到计划不存在')
    return true
  }

  /** 聚合单个计划在后台列表页展示所需的运行态摘要。 */
  private async buildPlanSummary(planId: number, planVersion: number) {
    const today = this.formatDateOnly(new Date())
    const [ruleRow, activeCycleRow, pendingRecordRow, pendingGrantRow] =
      await Promise.all([
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(this.checkInStreakRewardRuleTable)
          .where(
            and(
              eq(this.checkInStreakRewardRuleTable.planId, planId),
              eq(this.checkInStreakRewardRuleTable.planVersion, planVersion),
              isNull(this.checkInStreakRewardRuleTable.deletedAt),
            ),
          ),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(this.checkInCycleTable)
          .where(
            and(
              eq(this.checkInCycleTable.planId, planId),
              gte(this.checkInCycleTable.cycleEndDate, today),
            ),
          ),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(this.checkInRecordTable)
          .where(
            and(
              eq(this.checkInRecordTable.planId, planId),
              inArray(this.checkInRecordTable.rewardStatus, [
                CheckInRewardStatusEnum.PENDING,
                CheckInRewardStatusEnum.FAILED,
              ]),
            ),
          ),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(this.checkInStreakRewardGrantTable)
          .where(
            and(
              eq(this.checkInStreakRewardGrantTable.planId, planId),
              inArray(this.checkInStreakRewardGrantTable.grantStatus, [
                CheckInRewardStatusEnum.PENDING,
                CheckInRewardStatusEnum.FAILED,
              ]),
            ),
          ),
      ])

    return {
      ruleCount: Number(ruleRow[0]?.count ?? 0),
      activeCycleCount: Number(activeCycleRow[0]?.count ?? 0),
      pendingRewardCount:
        Number(pendingRecordRow[0]?.count ?? 0) +
        Number(pendingGrantRow[0]?.count ?? 0),
    }
  }
}
