import { BooleanProperty, EnumProperty, NumberProperty, StringProperty } from '@libs/base/decorators'
import {
  MatchModeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
} from '../sensitive-word-constant'

/**
 * 敏感词检测DTO
 */
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

/**
 * 请求替换敏感词dto
 */
export class SensitiveWordReplaceDto extends SensitiveWordDetectDto {
  @StringProperty({
    description: '替换字符',
    maxLength: 10,
    required: false,
    example: '*',
  })
  replaceChar?: string
}

/**
 * 匹配到的敏感词信息DTO
 */
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

/**
 * 敏感词替换响应DTO
 */
export class SensitiveWordReplaceResponseDto {
  @StringProperty({
    description: '替换后的文本',
    example: '这是一个***文本',
    validation: false,
  })
  replacedText!: string
}

/**
 * 最高敏感等级响应DTO
 */
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

/**
 * 检测器状态响应DTO
 */
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

/**
 * 敏感词数量响应DTO
 */
export class SensitiveWordCountResponseDto {
  @NumberProperty({
    description: '当前加载的敏感词数量',
    example: 100,
    validation: false,
  })
  count!: number
}
