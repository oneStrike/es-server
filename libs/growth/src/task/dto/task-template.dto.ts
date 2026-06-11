import {
  EventDefinitionEntityTypeEnum,
  EventDefinitionImplStatusEnum,
} from '@libs/growth/event-definition/event-definition.constant'
import { ArrayProperty, BooleanProperty, EnumProperty, StringProperty } from '@libs/platform/decorators'

export class TaskTemplateFilterFieldOptionDto {
  @StringProperty({
    description: '选项展示名',
    example: '漫画作品',
    maxLength: 80,
    validation: false,
  })
  label!: string

  @StringProperty({
    description: '选项值',
    example: 'comic_work',
    maxLength: 80,
    validation: false,
  })
  value!: string
}

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
    description: '字段值类型（数值；字符串；布尔值）',
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

  @ArrayProperty({
    description: '可选择的受控选项；为空时按 valueType 使用普通输入',
    itemClass: TaskTemplateFilterFieldOptionDto,
    required: false,
    validation: false,
  })
  options?: TaskTemplateFilterFieldOptionDto[]

  @StringProperty({
    description: '运营填写提示',
    example: '请选择目标类型',
    required: false,
    validation: false,
  })
  placeholder?: string

  @StringProperty({
    description: '后端匹配操作符',
    example: 'eq',
    required: false,
    validation: false,
  })
  operator?: string
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
      '底层事件实现状态（已声明但未接线；已正式接线；仅保留历史兼容）',
    example: EventDefinitionImplStatusEnum.IMPLEMENTED,
    enum: EventDefinitionImplStatusEnum,
  })
  implStatus!: EventDefinitionImplStatusEnum

  @BooleanProperty({
    description: '当前是否允许正式创建为生效任务',
    example: true,
  })
  isSelectable!: boolean

  @EnumProperty({
    description:
      '命中的目标实体类型（用户；任务头；任务实例；论坛主题；论坛回复；评论；漫画作品；小说作品；漫画章节；小说章节；签到记录；徽章；用户资料；通用内容；举报；被举报目标；管理端操作）',
    example: EventDefinitionEntityTypeEnum.COMIC_WORK,
    enum: EventDefinitionEntityTypeEnum,
  })
  targetEntityType!: EventDefinitionEntityTypeEnum

  @BooleanProperty({
    description: '当前模板是否支持按不同对象累计',
    example: true,
  })
  supportsUniqueCounting!: boolean

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
    example: ['若启用按不同对象累计，将按模板默认唯一维度自动去重。'],
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
        targetEntityType: EventDefinitionEntityTypeEnum.COMIC_WORK,
        supportsUniqueCounting: true,
        availableFilterFields: [
          {
            key: 'targetType',
            label: '目标类型',
            valueType: 'string',
            description: '用于限制同一模板下只统计特定目标类型。',
          },
        ],
        warningHints: [
          '若启用按不同对象累计，将按模板默认唯一维度自动去重。',
        ],
      },
    ],
  })
  list!: TaskEventTemplateOptionDto[]
}
