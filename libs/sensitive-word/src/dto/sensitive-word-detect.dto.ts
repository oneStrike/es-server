import { StringProperty } from '@libs/base/decorators'
import { ApiProperty } from '@nestjs/swagger'
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

  @ApiProperty({
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
  @ApiProperty({
    description: '敏感词内容',
    example: '测试',
  })
  word!: string

  @ApiProperty({
    description: '起始位置',
    example: 0,
  })
  start!: number

  @ApiProperty({
    description: '结束位置',
    example: 2,
  })
  end!: number

  @ApiProperty({
    description: '敏感词级别',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
  })
  level!: number

  @ApiProperty({
    description: '敏感词类型',
    example: SensitiveWordTypeEnum.POLITICS,
    enum: SensitiveWordTypeEnum,
  })
  type!: number

  @ApiProperty({
    description: '替换词',
    example: '***',
    required: false,
    type: String,
  })
  replaceWord?: string | null
}

/**
 * 敏感词替换响应DTO
 */
export class SensitiveWordReplaceResponseDto {
  @ApiProperty({
    description: '替换后的文本',
    example: '这是一个***文本',
  })
  replacedText!: string
}

/**
 * 最高敏感等级响应DTO
 */
export class SensitiveWordHighestLevelResponseDto {
  @ApiProperty({
    description: '敏感词最高等级',
    example: SensitiveWordLevelEnum.SEVERE,
    enum: SensitiveWordLevelEnum,
    required: false,
  })
  highestLevel?: SensitiveWordLevelEnum
}

/**
 * 检测器状态响应DTO
 */
export class SensitiveWordDetectStatusResponseDto {
  @ApiProperty({
    description: '检测器是否就绪',
    example: true,
  })
  isReady!: boolean

  @ApiProperty({
    description: '已加载的敏感词数量',
    example: 100,
  })
  wordCount!: number
}

/**
 * 敏感词数量响应DTO
 */
export class SensitiveWordCountResponseDto {
  @ApiProperty({
    description: '当前加载的敏感词数量',
    example: 100,
  })
  count!: number
}
