import { ValidateEnum, ValidateString } from '@libs/base/decorators'
import { ApiProperty } from '@nestjs/swagger'
import {
  ForumMatchModeEnum,
  ForumSensitiveWordLevelEnum,
  ForumSensitiveWordTypeEnum,
} from '../sensitive-word-constant'

/**
 * 敏感词检测请求DTO
 */
export class ForumSensitiveWordDetectDto {
  @ValidateEnum({
    description: '匹配模式',
    required: false,
    example: ForumMatchModeEnum.EXACT,
    enum: ForumMatchModeEnum,
  })
  matchMode?: ForumMatchModeEnum

  @ValidateString({
    description: '待检测的文本',
    required: true,
    example: '这是一个测试文本',
  })
  content!: string
}

/**
 * 请求替换敏感词dto
 */
export class ForumSensitiveWordReplaceDto extends ForumSensitiveWordDetectDto {
  @ValidateString({
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
export class ForumMatchedWordDto {
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
    example: ForumSensitiveWordLevelEnum.SEVERE,
    enum: ForumSensitiveWordLevelEnum,
  })
  level!: number

  @ApiProperty({
    description: '敏感词类型',
    example: ForumSensitiveWordTypeEnum.POLITICS,
    enum: ForumSensitiveWordTypeEnum,
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
export class ForumSensitiveWordReplaceResponseDto {
  @ApiProperty({
    description: '替换后的文本',
    example: '这是一个***文本',
  })
  replacedText!: string
}

/**
 * 最高敏感等级响应DTO
 */
export class ForumSensitiveWordHighestLevelResponseDto {
  @ApiProperty({
    description: '敏感词最高等级',
    example: ForumSensitiveWordLevelEnum.SEVERE,
    enum: ForumSensitiveWordLevelEnum,
    required: false,
  })
  highestLevel?: ForumSensitiveWordLevelEnum
}

/**
 * 检测器状态响应DTO
 */
export class ForumSensitiveWordDetectStatusResponseDto {
  @ApiProperty({
    description: '检测器是否已初始化',
    example: true,
  })
  isReady!: boolean

  @ApiProperty({
    description: '当前加载的敏感词数量',
    example: 100,
  })
  wordCount!: number
}

/**
 * 敏感词数量响应DTO
 */
export class ForumSensitiveWordCountResponseDto {
  @ApiProperty({
    description: '当前加载的敏感词数量',
    example: 100,
  })
  count!: number
}
