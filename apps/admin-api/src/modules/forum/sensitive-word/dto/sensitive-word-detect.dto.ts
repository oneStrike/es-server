import { BooleanProperty, EnumProperty, NestedProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'
import {
  MatchModeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
} from '@libs/sensitive-word'

export class SensitiveWordDetectDto {
  @StringProperty({
    description: '检测内容',
    maxLength: 10000,
    required: true,
    example: '这里是一段待检测的文本',
  })
  content!: string

  @EnumProperty({
    description: '匹配模式',
    required: false,
    enum: MatchModeEnum,
    example: MatchModeEnum.EXACT,
  })
  matchMode?: MatchModeEnum
}

export class SensitiveWordReplaceDto extends SensitiveWordDetectDto {
  @StringProperty({
    description: '替换字符',
    maxLength: 10,
    required: false,
    example: '*',
  })
  replaceChar?: string
}

export class MatchedWordDto {
  @StringProperty({
    description: '敏感词内容',
    example: '测试',
    validation: false,
  })
  word!: string

  @NumberProperty({
    description: '起始位置',
    example: 0,
    validation: false,
  })
  start!: number

  @NumberProperty({
    description: '结束位置',
    example: 2,
    validation: false,
  })
  end!: number

  @EnumProperty({
    description: '敏感词级别',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
    validation: false,
  })
  level!: number

  @EnumProperty({
    description: '敏感词类型',
    example: SensitiveWordTypeEnum.POLITICS,
    enum: SensitiveWordTypeEnum,
    validation: false,
  })
  type!: number

  @StringProperty({
    description: '替换词',
    example: '***',
    required: false,
    validation: false,
  })
  replaceWord?: string | null
}

export class SensitiveWordDetectResponseDto {
  @NestedProperty({
    description: '命中的敏感词列表',
    type: MatchedWordDto,
    isArray: true,
    validation: false,
  })
  hits!: MatchedWordDto[]

  @EnumProperty({
    description: '最高敏感等级',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
    required: false,
    validation: false,
  })
  highestLevel?: SensitiveWordLevelEnum
}

export class SensitiveWordReplaceResponseDto {
  @StringProperty({
    description: '替换后的文本',
    example: '这是一个***文本',
    validation: false,
  })
  replacedText!: string
}

export class SensitiveWordHighestLevelResponseDto {
  @EnumProperty({
    description: '敏感词最高等级',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
    required: false,
    validation: false,
  })
  highestLevel?: SensitiveWordLevelEnum
}

export class SensitiveWordDetectStatusResponseDto {
  @BooleanProperty({
    description: '检测器是否就绪',
    example: true,
    validation: false,
  })
  isReady!: boolean

  @NumberProperty({
    description: '已加载的敏感词数量',
    example: 100,
    validation: false,
  })
  wordCount!: number
}

export class SensitiveWordCountResponseDto {
  @NumberProperty({
    description: '当前加载的敏感词数量',
    example: 100,
    validation: false,
  })
  count!: number
}
