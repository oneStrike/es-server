import type { QueryGrowthRewardSettlementPageDto } from '@libs/growth/growth-reward/dto/growth-reward-settlement.dto'
import type { QueryGrowthRuleEventPageDto } from '@libs/growth/growth/dto/growth.dto'
import { DrizzleService } from '@db/core'
import {
  EventDefinitionConsumerEnum,
  EventDefinitionImplStatusEnum,
} from '@libs/growth/event-definition/event-definition.constant'
import { EventDefinitionService } from '@libs/growth/event-definition/event-definition.service'
import { GrowthRewardSettlementRetryService } from '@libs/growth/growth-reward/growth-reward-settlement-retry.service'
import { GrowthRewardSettlementService } from '@libs/growth/growth-reward/growth-reward-settlement.service'
import { GrowthRewardRuleAssetTypeEnum } from '@libs/growth/reward-rule/reward-rule.constant'
import { normalizeTaskType, TaskDefinitionStatusEnum, TaskStepTriggerModeEnum } from '@libs/growth/task/task.constant'

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

  private get db() {
    return this.drizzle.db
  }

  async getGrowthRewardSettlementPage(
    query: QueryGrowthRewardSettlementPageDto,
  ) {
    return this.growthRewardSettlementStore.getSettlementPage(query)
  }

  async retryGrowthRewardSettlement(id: number, adminUserId: number) {
    return this.growthRewardSettlementRetryService.retrySettlement(
      id,
      adminUserId,
    )
  }

  async retryPendingGrowthRewardSettlementsBatch(
    limit: number | undefined,
    adminUserId: number,
  ) {
    return this.growthRewardSettlementRetryService.retryPendingSettlementsBatch(
      limit,
      adminUserId,
    )
  }

  private get growthRewardRule() {
    return this.drizzle.schema.growthRewardRule
  }

  private get taskTable() {
    return this.drizzle.schema.taskDefinition
  }

  private get taskStepTable() {
    return this.drizzle.schema.taskStep
  }

  /**
   * 按事件聚合基础奖励与任务 bonus 关联关系。
   *
   * 该视图只负责“读模型解释力”，不改动积分/经验底层表结构。
   */
  async getGrowthRuleEventPage(query: QueryGrowthRuleEventPageDto) {
    const definitions = this.eventDefinitionService
      .listRuleConfigurableEventDefinitions()
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
        const assetRules = (assetRuleMap.get(definition.code) ?? [])
          .sort((prev, next) => {
            if (prev.assetType !== next.assetType) {
              return prev.assetType - next.assetType
            }
            return prev.id - next.id
          })
          .map((item) => ({
            assetType: item.assetType as GrowthRewardRuleAssetTypeEnum,
            assetKey: item.assetKey || undefined,
            exists: true,
            id: item.id,
            isEnabled: item.isEnabled,
            amount: item.delta,
            dailyLimit: item.dailyLimit,
            totalLimit: item.totalLimit,
            remark: item.remark ?? undefined,
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
    return {
      list: rows.slice(page.offset, page.offset + page.limit),
      total: rows.length,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
    }
  }

  private async queryRewardRules(ruleTypes: number[]) {
    if (ruleTypes.length === 0) {
      return []
    }
    return this.db
      .select()
      .from(this.growthRewardRule)
      .where(inArray(this.growthRewardRule.type, ruleTypes))
  }

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
