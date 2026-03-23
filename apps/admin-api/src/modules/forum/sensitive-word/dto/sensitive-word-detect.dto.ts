import { ArrayProperty, BooleanProperty, EnumProperty, NumberProperty, StringProperty } from '@libs/platform/decorators'
import {
  BaseSensitiveWordHitDto,
  MatchModeEnum,
  SensitiveWordLevelEnum,
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

export class SensitiveWordDetectResponseDto {
  @ArrayProperty({
    description: '命中的敏感词列表',
    itemClass: BaseSensitiveWordHitDto,
    itemType: 'object',
    validation: false,
  })
  hits!: BaseSensitiveWordHitDto[]

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
