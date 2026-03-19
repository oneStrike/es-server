import {
  BooleanProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'

/**
 * 标签基础 DTO
 */
export class BaseTagDto extends BaseDto {
  @StringProperty({
    description: '标签名称',
    example: '科幻',
    required: true,
    maxLength: 20,
  })
  name!: string

  @StringProperty({
    description: '标签图标URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 255,
  })
  icon?: string

  @NumberProperty({
    description: '人气值',
    example: 1000,
    required: false,
    min: 0,
  })
  popularity!: number

  @NumberProperty({
    description: '排序值',
    example: 1,
    required: false,
    min: 0,
    max: 32767,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: false,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '标签描述',
    example: '漫画类型',
    required: false,
    maxLength: 200,
  })
  description?: string
}
