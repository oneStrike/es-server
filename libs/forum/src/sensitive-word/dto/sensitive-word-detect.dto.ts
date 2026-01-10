import { ValidateEnum, ValidateString } from '@libs/base/decorators'
import { ApiProperty } from '@nestjs/swagger'
import {
  MatchModeEnum,
  SensitiveWordLevelEnum,
  SensitiveWordTypeEnum,
} from '../sensitive-word-constant'

/**
 * 敏感词检测请求DTO
 */
export class SensitiveWordDetectDto {
  @ValidateEnum({
    description: '匹配模式',
    required: false,
    example: MatchModeEnum.EXACT,
    enum: MatchModeEnum,
  })
  matchMode?: MatchModeEnum

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
export class SensitiveWordReplaceDto extends SensitiveWordDetectDto {
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
