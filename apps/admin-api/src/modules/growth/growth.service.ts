import type { QueryGrowthRewardSettlementPageDto } from '@libs/growth/growth-reward/dto/growth-reward-settlement.dto'
import type {
  GrowthConfigurableRewardEventOptionDto,
  QueryGrowthRuleEventPageDto,
} from '@libs/growth/growth/dto/growth.dto'
import { DrizzleService, toPageResult } from '@db/core'
import {
  EventDefinitionConsumerEnum,
  EventDefinitionImplStatusEnum,
} from '@libs/growth/event-definition/event-definition.constant'
import { EventDefinitionService } from '@libs/growth/event-definition/event-definition.service'
import { GrowthRewardSettlementRetryService } from '@libs/growth/growth-reward/growth-reward-settlement-retry.service'
import { GrowthRewardSettlementService } from '@libs/growth/growth-reward/growth-reward-settlement.service'
import {
  normalizeTaskType,
  TaskDefinitionStatusEnum,
  TaskStepTriggerModeEnum,
} from '@libs/growth/task/task.constant'

import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

@Injectable()
export class GrowthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly eventDefinitionService: EventDefinitionService,
    private readonly growthRewardSettlementStore: GrowthRewardSettlementService,
    private readonly growthRewardSettlementRetryService: GrowthRewardSettlementRetryService,
  ) {}

  // 复用当前模块共享数据库连接。
  private get db() {
    return this.drizzle.db
  }

  // 分页查询成长奖励结算记录。
  async getGrowthRewardSettlementPage(
    query: QueryGrowthRewardSettlementPageDto,
  ) {
    return this.growthRewardSettlementStore.getSettlementPage(query)
  }

  // 重试单条成长奖励结算。
  async retryGrowthRewardSettlement(id: number, adminUserId: number) {
    return this.growthRewardSettlementRetryService.retrySettlement(
      id,
      adminUserId,
    )
  }

  // 批量重试待处理的成长奖励结算。
  async retryPendingGrowthRewardSettlementsBatch(
    limit: number | undefined,
    adminUserId: number,
  ) {
    return this.growthRewardSettlementRetryService.retryPendingSettlementsBatch(
      limit,
      adminUserId,
    )
  }

  // 复用成长奖励规则表。
  private get growthRewardRule() {
    return this.drizzle.schema.growthRewardRule
  }

  // 复用任务定义表。
  private get taskTable() {
    return this.drizzle.schema.taskDefinition
  }

  // 复用任务步骤表。
  private get taskStepTable() {
    return this.drizzle.schema.taskStep
  }

  private get growthRewardEventSelect() {
    return {
      id: this.growthRewardRule.id,
      type: this.growthRewardRule.type,
      assetType: this.growthRewardRule.assetType,
      assetKey: this.growthRewardRule.assetKey,
      delta: this.growthRewardRule.delta,
      dailyLimit: this.growthRewardRule.dailyLimit,
      totalLimit: this.growthRewardRule.totalLimit,
      isEnabled: this.growthRewardRule.isEnabled,
      remark: this.growthRewardRule.remark,
    }
  }

  // 按事件聚合基础奖励与任务 bonus 关联关系，只负责读模型解释力。
  async getGrowthRuleEventPage(query: QueryGrowthRuleEventPageDto) {
    const definitions = this.eventDefinitionService
      .listGrowthEventCoverageDefinitions()
      .filter((item) => {
        if (query.type !== undefined && item.code !== query.type) {
          return false
        }
        if (query.isImplemented !== undefined) {
          const isImplemented =
            item.implStatus === EventDefinitionImplStatusEnum.IMPLEMENTED
          if (isImplemented !== query.isImplemented) {
            return false
          }
        }
        if (
          query.isRuleConfigurable !== undefined &&
          item.isRuleConfigurable !== query.isRuleConfigurable
        ) {
          return false
        }
        return true
      })

    const ruleTypes = definitions.map((item) => item.code)
    const [rewardRules, taskRows] = await Promise.all([
      this.queryRewardRules(ruleTypes),
      this.queryEventTasks(ruleTypes),
    ])

    const assetRuleMap = new Map<number, typeof rewardRules>()
    for (const rewardRule of rewardRules) {
      const current = assetRuleMap.get(rewardRule.type) ?? []
      current.push(rewardRule)
      assetRuleMap.set(rewardRule.type, current)
    }
    const taskBindingMap = this.buildTaskBindingMap(taskRows)

    const rows = definitions
      .map((definition) => {
        const disabledReason =
          this.eventDefinitionService.getRuleConfigDisabledReason(
            definition.code,
          )
        const assetRules = (assetRuleMap.get(definition.code) ?? [])
          .sort((prev, next) => {
            if (prev.assetType !== next.assetType) {
              return prev.assetType - next.assetType
            }
            return prev.id - next.id
          })
          .map((item) => ({
            assetType: item.assetType,
            assetKey: item.assetKey || null,
            exists: true,
            id: item.id,
            isEnabled: item.isEnabled,
            amount: item.delta,
            dailyLimit: item.dailyLimit,
            totalLimit: item.totalLimit,
            remark: item.remark ?? null,
          }))
        const taskBinding = taskBindingMap.get(definition.code) ?? {
          exists: false,
          relatedTaskCount: 0,
          publishedTaskCount: 0,
          enabledTaskCount: 0,
          sceneTypes: [],
          taskIds: [],
        }

        return {
          ruleType: definition.code,
          ruleKey: definition.key,
          eventName: definition.label,
          domain: definition.domain,
          governanceGate: definition.governanceGate,
          implStatus: definition.implStatus,
          isImplemented:
            definition.implStatus === EventDefinitionImplStatusEnum.IMPLEMENTED,
          isRuleConfigurable: definition.isRuleConfigurable,
          supportsExperienceRule: disabledReason === null,
          disabledReason,
          supportsTaskObjective: definition.consumers.includes(
            EventDefinitionConsumerEnum.TASK,
          ),
          rewardPolicy:
            '基础奖励与任务 bonus 默认可叠加；任务奖励属于额外 bonus。',
          hasBaseReward: assetRules.length > 0,
          hasTask: taskBinding.exists,
          assetRules,
          taskBinding,
        }
      })
      .filter((item) => {
        if (query.hasTask !== undefined && item.hasTask !== query.hasTask) {
          return false
        }
        if (
          query.hasBaseReward !== undefined &&
          item.hasBaseReward !== query.hasBaseReward
        ) {
          return false
        }
        return true
      })
      .sort((prev, next) => prev.ruleType - next.ruleType)

    const page = this.drizzle.buildPage(query)
    return toPageResult(
      rows.slice(page.offset, page.offset + page.limit),
      rows.length,
      page,
    )
  }

  // 获取可配置奖励事件选项列表。
  getConfigurableRewardEventOptions(): GrowthConfigurableRewardEventOptionDto[] {
    return this.eventDefinitionService
      .listRuleConfigurableEventDefinitions()
      .map((definition) => ({
        ruleType: definition.code,
        ruleKey: definition.key,
        eventName: definition.label,
        domain: definition.domain,
        governanceGate: definition.governanceGate,
        implStatus: definition.implStatus,
        isImplemented: true,
        isRuleConfigurable: true,
        supportsExperienceRule: true,
      }))
      .sort((prev, next) => prev.ruleType - next.ruleType)
  }

  // 查询指定规则类型对应的奖励规则。
  private async queryRewardRules(ruleTypes: number[]) {
    if (ruleTypes.length === 0) {
      return []
    }
    return this.db
      .select(this.growthRewardEventSelect)
      .from(this.growthRewardRule)
      .where(
        and(
          inArray(this.growthRewardRule.type, ruleTypes),
          isNull(this.growthRewardRule.archivedAt),
        ),
      )
  }

  // 查询指定事件类型关联的任务及其步骤。
  private async queryEventTasks(ruleTypes: number[]) {
    if (ruleTypes.length === 0) {
      return []
    }
    return this.db
      .select({
        id: this.taskTable.id,
        type: this.taskTable.sceneType,
        status: this.taskTable.status,
        isEnabled: sql<boolean>`${this.taskTable.status} = 1`,
        eventCode: this.taskStepTable.eventCode,
      })
      .from(this.taskTable)
      .innerJoin(
        this.taskStepTable,
        eq(this.taskStepTable.taskId, this.taskTable.id),
      )
      .where(
        and(
          isNull(this.taskTable.deletedAt),
          eq(this.taskStepTable.triggerMode, TaskStepTriggerModeEnum.EVENT),
          inArray(this.taskStepTable.eventCode, ruleTypes),
        ),
      )
  }

  // 将任务行按事件码聚合为绑定摘要 Map。
  private buildTaskBindingMap(
    taskRows: Array<{
      id: number
      type: number
      status: number
      isEnabled: boolean
      eventCode: number | null
    }>,
  ) {
    const taskBindingMap = new Map<
      number,
      {
        exists: boolean
        relatedTaskCount: number
        publishedTaskCount: number
        enabledTaskCount: number
        sceneTypes: number[]
        taskIds: number[]
      }
    >()

    for (const taskRow of taskRows) {
      if (!taskRow.eventCode) {
        continue
      }
      const current = taskBindingMap.get(taskRow.eventCode) ?? {
        exists: false,
        relatedTaskCount: 0,
        publishedTaskCount: 0,
        enabledTaskCount: 0,
        sceneTypes: [],
        taskIds: [],
      }

      const sceneType = normalizeTaskType(taskRow.type)
      const nextSceneTypes = current.sceneTypes.includes(sceneType)
        ? current.sceneTypes
        : [...current.sceneTypes, sceneType]

      taskBindingMap.set(taskRow.eventCode, {
        exists: true,
        relatedTaskCount: current.relatedTaskCount + 1,
        publishedTaskCount:
          current.publishedTaskCount +
          (taskRow.status === TaskDefinitionStatusEnum.ACTIVE ? 1 : 0),
        enabledTaskCount:
          current.enabledTaskCount + (taskRow.isEnabled ? 1 : 0),
        sceneTypes: nextSceneTypes.sort((prev, next) => prev - next),
        taskIds: [...current.taskIds, taskRow.id].sort(
          (prev, next) => prev - next,
        ),
      })
    }

    return taskBindingMap
  }
}
