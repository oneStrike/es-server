import type { EventDefinition } from '@libs/growth/event-definition/event-definition.type'
import type { EventEnvelopeContext } from '@libs/growth/event-definition/event-envelope.type'
import type {
  TaskEventTemplate,
  TaskEventTemplateFilterField,
  TaskEventTemplateUniqueDimension,
} from './types/task-event-template.type'
import type {
  TaskEventFilterPayload,
  TaskStepFilterValueView,
  TaskUniqueDimensionResolvedValue,
} from './types/task.type'
import {
  EventDefinitionConsumerEnum,
  EventDefinitionEntityTypeEnum,
  EventDefinitionImplStatusEnum,
} from '@libs/growth/event-definition/event-definition.constant'
import { EventDefinitionService } from '@libs/growth/event-definition/event-definition.service'
import { BadRequestException, Injectable } from '@nestjs/common'
import { TaskStepProgressModeEnum } from './task.constant'

/**
 * Task 侧事件模板注册表。
 *
 * 在 event-definition 之上补齐 task 配置所需的受控元数据，避免后台与执行层直接依赖原始事件定义。
 */
@Injectable()
export class TaskEventTemplateRegistry {
  // 注入事件定义查询服务，作为任务模板事实源。
  constructor(
    private readonly eventDefinitionService: EventDefinitionService,
  ) {}

  // 枚举所有 task 可见事件模板。
  listTemplates() {
    return this.eventDefinitionService
      .listEventDefinitions({
        consumer: EventDefinitionConsumerEnum.TASK,
        isRuleConfigurable: true,
      })
      .map((definition) => this.toTaskEventTemplate(definition))
  }

  // 枚举当前允许被正式创建为任务的事件模板。
  listSelectableTemplates() {
    return this.listTemplates().filter((template) => template.isSelectable)
  }

  // 按模板键获取单条事件模板。
  getTemplateByKey(templateKey: string) {
    return (
      this.listTemplates().find(
        (template) => template.templateKey === templateKey,
      ) ?? null
    )
  }

  // 按事件编码获取模板。
  getTemplateByEventCode(eventCode: number) {
    return (
      this.listTemplates().find(
        (template) => template.eventCode === eventCode,
      ) ?? null
    )
  }

  // 把结构化过滤条件归一化为内部持久化 payload。
  normalizeFilterPayload(
    templateKey: string | null | undefined,
    filters?: TaskStepFilterValueView[] | null,
  ) {
    if (!filters || filters.length === 0) {
      return null
    }

    const template = templateKey ? this.getTemplateByKey(templateKey) : null
    if (!template) {
      throw new BadRequestException('事件步骤模板不存在')
    }

    const fieldMap = new Map(
      template.availableFilterFields.map((field) => [field.key, field]),
    )
    const payload: Record<string, boolean | number | string> = {}

    for (const filter of filters) {
      const key = filter.key.trim()
      const value = filter.value.trim()
      const field = fieldMap.get(key)

      if (!field) {
        throw new BadRequestException(`当前模板不支持过滤字段 ${filter.key}`)
      }
      if (!value) {
        throw new BadRequestException(`过滤字段 ${filter.key} 的值不能为空`)
      }

      payload[key] = this.parseFilterValue(field.valueType, value, filter.key)
    }

    return Object.keys(payload).length > 0 ? payload : null
  }

  // 把内部过滤 payload 转成可读的结构化字段视图。
  buildFilterValues(
    templateKey: string | null | undefined,
    filterPayload: TaskEventFilterPayload,
  ): TaskStepFilterValueView[] {
    if (!filterPayload || Object.keys(filterPayload).length === 0) {
      return []
    }

    const template = templateKey ? this.getTemplateByKey(templateKey) : null
    const fieldMap = new Map(
      (template?.availableFilterFields ?? []).map((field) => [
        field.key,
        field,
      ]),
    )

    return Object.entries(filterPayload).map(([key, value]) => ({
      key,
      label: fieldMap.get(key)?.label,
      value: String(value),
    }))
  }

  // 判断事件上下文是否满足模板过滤条件。
  matchesFilterPayload(
    filterPayload: TaskEventFilterPayload,
    targetType: string,
    targetId: number,
    eventContext?: EventEnvelopeContext,
  ) {
    if (!filterPayload || Object.keys(filterPayload).length === 0) {
      return true
    }

    return Object.entries(filterPayload).every(
      ([key, value]) =>
        JSON.stringify(
          this.resolveFilterSourceValue(
            key,
            targetType,
            targetId,
            eventContext,
          ),
        ) === JSON.stringify(value),
    )
  }

  // 按模板定义提取唯一维度值。
  resolveUniqueDimensionValue(
    templateKey: string,
    uniqueDimensionKey: string,
    targetId: number,
    context?: EventEnvelopeContext,
  ): TaskUniqueDimensionResolvedValue | null {
    const template = this.getTemplateByKey(templateKey)
    const dimension = template?.availableUniqueDimensions.find(
      (item) => item.key === uniqueDimensionKey,
    )

    if (!template || !dimension) {
      return null
    }

    if (dimension.source === 'target_id') {
      return {
        key: dimension.key,
        value: String(targetId),
      }
    }

    if (!dimension.contextKey) {
      return null
    }

    const contextValue = context?.[dimension.contextKey]
    if (
      contextValue === undefined ||
      contextValue === null ||
      String(contextValue).trim() === ''
    ) {
      return null
    }

    return {
      key: dimension.key,
      value: String(contextValue),
    }
  }

  // 把底层事件定义映射成 task 专属模板。
  private toTaskEventTemplate(definition: EventDefinition): TaskEventTemplate {
    const uniqueDimensions = this.resolveTemplateUniqueDimensions(
      definition.targetType,
    )
    return {
      templateKey: definition.key,
      eventCode: definition.code,
      label: definition.label,
      implStatus: definition.implStatus,
      isSelectable:
        definition.implStatus === EventDefinitionImplStatusEnum.IMPLEMENTED,
      supportedProgressModes: this.resolveSupportedProgressModes(
        definition.targetType,
      ),
      targetEntityType: definition.targetType,
      defaultUniqueDimensionKey: uniqueDimensions[0]?.key,
      availableUniqueDimensions: uniqueDimensions,
      availableFilterFields: this.resolveTemplateFilterFields(
        definition.targetType,
      ),
      warningHints: this.resolveWarningHints(definition),
    }
  }

  // 解析模板支持的进度模式。
  private resolveSupportedProgressModes(
    targetType: EventDefinitionEntityTypeEnum,
  ) {
    if (this.supportsUniqueCount(targetType)) {
      return [
        TaskStepProgressModeEnum.ONCE,
        TaskStepProgressModeEnum.COUNT,
        TaskStepProgressModeEnum.UNIQUE_COUNT,
      ]
    }
    return [TaskStepProgressModeEnum.ONCE, TaskStepProgressModeEnum.COUNT]
  }

  // 解析模板支持的唯一维度。
  private resolveTemplateUniqueDimensions(
    targetType: EventDefinitionEntityTypeEnum,
  ): TaskEventTemplateUniqueDimension[] {
    if (!this.supportsUniqueCount(targetType)) {
      return []
    }

    return [
      {
        key: 'object_id',
        label: '目标对象 ID',
        source: 'target_id',
      },
    ]
  }

  // 解析模板支持的过滤字段。
  private resolveTemplateFilterFields(
    targetType: EventDefinitionEntityTypeEnum,
  ): TaskEventTemplateFilterField[] {
    if (this.supportsUniqueCount(targetType)) {
      return [
        {
          key: 'targetType',
          label: '目标类型',
          valueType: 'string',
          description: '用于限制同一模板下只统计特定目标类型。',
        },
      ]
    }

    return []
  }

  // 解析模板需要给运营展示的提醒文案。
  private resolveWarningHints(definition: EventDefinition) {
    const hints: string[] = []

    if (definition.implStatus !== EventDefinitionImplStatusEnum.IMPLEMENTED) {
      hints.push('当前事件尚未接通正式 producer，不能创建为生效任务。')
    }
    if (this.supportsUniqueCount(definition.targetType)) {
      hints.push('若选择“按唯一对象累计”，必须同时配置唯一维度与去重范围。')
    }

    return hints
  }

  // 判断目标实体是否适合启用唯一对象累计模式。
  private supportsUniqueCount(targetType: EventDefinitionEntityTypeEnum) {
    return targetType !== EventDefinitionEntityTypeEnum.USER_PROFILE
  }

  // 解析过滤字段值的类型。
  private parseFilterValue(
    valueType: 'number' | 'string' | 'boolean',
    value: string,
    key: string,
  ) {
    if (valueType === 'string') {
      return value
    }
    if (valueType === 'number') {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`过滤字段 ${key} 必须是合法数字`)
      }
      return parsed
    }
    if (value === 'true') {
      return true
    }
    if (value === 'false') {
      return false
    }
    throw new BadRequestException(`过滤字段 ${key} 必须是 true 或 false`)
  }

  // 解析过滤字段在事件外壳中的真实取值。
  private resolveFilterSourceValue(
    key: string,
    targetType: string,
    targetId: number,
    eventContext?: EventEnvelopeContext,
  ) {
    if (key === 'targetType') {
      return targetType
    }
    if (key === 'targetId') {
      return targetId
    }
    return eventContext?.[key]
  }
}
