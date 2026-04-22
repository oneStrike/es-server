import {
  EventDefinitionEntityTypeEnum,
  EventDefinitionImplStatusEnum,
} from '@libs/growth/event-definition/event-definition.constant'
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property'
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property'
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property'
import { StringProperty } from '@libs/platform/decorators/validate/string-property'
import { TaskStepProgressModeEnum } from '../task.constant'

export class TaskTemplateFilterFieldDto {
  @StringProperty({
    description: '过滤字段稳定键',
    example: 'targetType',
    maxLength: 80,
  })
  key!: string

  @StringProperty({
    description: '运营侧可见名称',
    example: '目标类型',
    maxLength: 80,
  })
  label!: string

  @EnumProperty({
    description: '字段值类型（number=数值；string=字符串；boolean=布尔值）',
    example: 'string',
    enum: { NUMBER: 'number', STRING: 'string', BOOLEAN: 'boolean' },
  })
  valueType!: 'number' | 'string' | 'boolean'

  @StringProperty({
    description: '字段业务说明',
    example: '用于限制同一模板下只统计特定目标类型。',
    maxLength: 255,
  })
  description!: string
}

export class TaskTemplateUniqueDimensionDto {
  @StringProperty({
    description: '唯一维度稳定键',
    example: 'object_id',
    maxLength: 80,
  })
  key!: string

  @StringProperty({
    description: '运营侧可见名称',
    example: '目标对象 ID',
    maxLength: 80,
  })
  label!: string

  @EnumProperty({
    description:
      '唯一维度来源（target_id=直接使用目标对象 ID；context_key=从事件上下文中读取）',
    example: 'target_id',
    enum: { TARGET_ID: 'target_id', CONTEXT_KEY: 'context_key' },
  })
  source!: 'target_id' | 'context_key'

  @StringProperty({
    description: '当来源为上下文字段时使用的 context key',
    example: 'workId',
    required: false,
    maxLength: 80,
  })
  contextKey?: string
}

export class TaskTemplateFilterValueDto {
  @StringProperty({
    description: '过滤字段稳定键',
    example: 'targetType',
    maxLength: 80,
  })
  key!: string

  @StringProperty({
    description: '字段展示名称',
    example: '目标类型',
    required: false,
    maxLength: 80,
    validation: false,
  })
  label?: string

  @StringProperty({
    description: '过滤字段值的结构化字符串表示',
    example: 'comic_work',
    maxLength: 255,
  })
  value!: string
}

export class TaskEventTemplateOptionDto {
  @StringProperty({
    description: '模板稳定键',
    example: 'COMIC_WORK_VIEW',
    maxLength: 80,
  })
  templateKey!: string

  @StringProperty({
    description: '模板名称',
    example: '漫画作品浏览',
    maxLength: 120,
  })
  label!: string

  @EnumProperty({
    description:
      '底层事件实现状态（declared=已声明但未接线；implemented=已正式接线；legacy_compat=仅保留历史兼容）',
    example: EventDefinitionImplStatusEnum.IMPLEMENTED,
    enum: EventDefinitionImplStatusEnum,
  })
  implStatus!: EventDefinitionImplStatusEnum

  @BooleanProperty({
    description: '当前是否允许正式创建为生效任务',
    example: true,
  })
  isSelectable!: boolean

  @ArrayProperty({
    description: '支持的步骤进度模式列表',
    example: [TaskStepProgressModeEnum.ONCE, TaskStepProgressModeEnum.COUNT],
    itemEnum: TaskStepProgressModeEnum,
  })
  supportedProgressModes!: TaskStepProgressModeEnum[]

  @EnumProperty({
    description:
      '命中的目标实体类型（如 comic_work=漫画作品；novel_work=小说作品；content=内容；user=用户）',
    example: EventDefinitionEntityTypeEnum.COMIC_WORK,
    enum: EventDefinitionEntityTypeEnum,
  })
  targetEntityType!: EventDefinitionEntityTypeEnum

  @StringProperty({
    description: '默认唯一维度键',
    example: 'object_id',
    required: false,
    maxLength: 80,
  })
  defaultUniqueDimensionKey?: string

  @ArrayProperty({
    description: '可选唯一维度列表',
    itemClass: TaskTemplateUniqueDimensionDto,
    example: [{ key: 'object_id', label: '目标对象 ID', source: 'target_id' }],
  })
  availableUniqueDimensions!: TaskTemplateUniqueDimensionDto[]

  @ArrayProperty({
    description: '可选过滤字段列表',
    itemClass: TaskTemplateFilterFieldDto,
    example: [
      {
        key: 'targetType',
        label: '目标类型',
        valueType: 'string',
        description: '用于限制同一模板下只统计特定目标类型。',
      },
    ],
  })
  availableFilterFields!: TaskTemplateFilterFieldDto[]

  @ArrayProperty({
    description: '需要在后台显式展示的提醒文案',
    itemType: 'string',
    example: ['若选择“按唯一对象累计”，必须同时配置唯一维度与去重范围。'],
  })
  warningHints!: string[]
}

export class TaskTemplateOptionsResponseDto {
  @ArrayProperty({
    description: '模板列表',
    itemClass: TaskEventTemplateOptionDto,
    example: [
      {
        templateKey: 'COMIC_WORK_VIEW',
        label: '漫画作品浏览',
        implStatus: EventDefinitionImplStatusEnum.IMPLEMENTED,
        isSelectable: true,
        supportedProgressModes: [
          TaskStepProgressModeEnum.ONCE,
          TaskStepProgressModeEnum.COUNT,
          TaskStepProgressModeEnum.UNIQUE_COUNT,
        ],
        targetEntityType: EventDefinitionEntityTypeEnum.COMIC_WORK,
        defaultUniqueDimensionKey: 'object_id',
        availableUniqueDimensions: [
          { key: 'object_id', label: '目标对象 ID', source: 'target_id' },
        ],
        availableFilterFields: [
          {
            key: 'targetType',
            label: '目标类型',
            valueType: 'string',
            description: '用于限制同一模板下只统计特定目标类型。',
          },
        ],
        warningHints: [
          '若选择“按唯一对象累计”，必须同时配置唯一维度与去重范围。',
        ],
      },
    ],
  })
  list!: TaskEventTemplateOptionDto[]
}
