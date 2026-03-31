import type { QueryGrowthRuleEventPageInput } from './growth.type'
import { DrizzleService } from '@db/core'
import {
  EventDefinitionConsumerEnum,
  EventDefinitionImplStatusEnum,
  EventDefinitionService,
} from '@libs/growth/event-definition'
import {
  normalizeTaskType,
  TaskObjectiveTypeEnum,
  TaskStatusEnum,
} from '@libs/growth/task'
import { Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull } from 'drizzle-orm'

@Injectable()
export class GrowthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly eventDefinitionService: EventDefinitionService,
  ) {}

  private get db() {
    return this.drizzle.db
  }

  private get userPointRule() {
    return this.drizzle.schema.userPointRule
  }

  private get userExperienceRule() {
    return this.drizzle.schema.userExperienceRule
  }

  private get taskTable() {
    return this.drizzle.schema.task
  }

  /**
   * 按事件聚合基础奖励与任务 bonus 关联关系。
   *
   * 该视图只负责“读模型解释力”，不改动积分/经验底层表结构。
   */
  async getGrowthRuleEventPage(query: QueryGrowthRuleEventPageInput) {
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
    const [pointRules, experienceRules, taskRows] = await Promise.all([
      this.queryPointRules(ruleTypes),
      this.queryExperienceRules(ruleTypes),
      this.queryEventTasks(ruleTypes),
    ])

    const pointRuleMap = new Map(pointRules.map((item) => [item.type, item]))
    const experienceRuleMap = new Map(
      experienceRules.map((item) => [item.type, item]),
    )
    const taskBindingMap = this.buildTaskBindingMap(taskRows)

    const rows = definitions
      .map((definition) => {
        const pointRule = pointRuleMap.get(definition.code)
        const experienceRule = experienceRuleMap.get(definition.code)
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
          hasBaseReward: Boolean(pointRule || experienceRule),
          hasTask: taskBinding.exists,
          pointRule: {
            exists: Boolean(pointRule),
            id: pointRule?.id,
            isEnabled: pointRule?.isEnabled,
            amount: pointRule?.points,
            dailyLimit: pointRule?.dailyLimit,
            totalLimit: pointRule?.totalLimit,
            remark: pointRule?.remark ?? undefined,
          },
          experienceRule: {
            exists: Boolean(experienceRule),
            id: experienceRule?.id,
            isEnabled: experienceRule?.isEnabled,
            amount: experienceRule?.experience,
            dailyLimit: experienceRule?.dailyLimit,
            totalLimit: experienceRule?.totalLimit,
            remark: experienceRule?.remark ?? undefined,
          },
          taskBinding,
        }
      })
      .filter((item) => {
        if (query.hasTask !== undefined && item.hasTask !== query.hasTask) {
          return false
        }
        if (
          query.hasBaseReward !== undefined
          && item.hasBaseReward !== query.hasBaseReward
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

  private async queryPointRules(ruleTypes: number[]) {
    if (ruleTypes.length === 0) {
      return []
    }
    return this.db
      .select()
      .from(this.userPointRule)
      .where(inArray(this.userPointRule.type, ruleTypes))
  }

  private async queryExperienceRules(ruleTypes: number[]) {
    if (ruleTypes.length === 0) {
      return []
    }
    return this.db
      .select()
      .from(this.userExperienceRule)
      .where(inArray(this.userExperienceRule.type, ruleTypes))
  }

  private async queryEventTasks(ruleTypes: number[]) {
    if (ruleTypes.length === 0) {
      return []
    }
    return this.db
      .select({
        id: this.taskTable.id,
        type: this.taskTable.type,
        status: this.taskTable.status,
        isEnabled: this.taskTable.isEnabled,
        eventCode: this.taskTable.eventCode,
      })
      .from(this.taskTable)
      .where(
        and(
          isNull(this.taskTable.deletedAt),
          eq(this.taskTable.objectiveType, TaskObjectiveTypeEnum.EVENT_COUNT),
          inArray(this.taskTable.eventCode, ruleTypes),
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
    const taskBindingMap = new Map<number, {
      exists: boolean
      relatedTaskCount: number
      publishedTaskCount: number
      enabledTaskCount: number
      sceneTypes: number[]
      taskIds: number[]
    }>()

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
          current.publishedTaskCount
          + (taskRow.status === TaskStatusEnum.PUBLISHED ? 1 : 0),
        enabledTaskCount: current.enabledTaskCount + (taskRow.isEnabled ? 1 : 0),
        sceneTypes: nextSceneTypes.sort((prev, next) => prev - next),
        taskIds: [...current.taskIds, taskRow.id].sort((prev, next) => prev - next),
      })
    }

    return taskBindingMap
  }
}
