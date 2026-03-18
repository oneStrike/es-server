import { GenderEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { AuthorTypeEnum } from '../author.constant'

/**
 * 作者基础DTO
 */
export class BaseAuthorDto extends BaseDto {
  @StringProperty({
    description: '作者姓名',
    example: '村上春树',
    required: true,
  })
  name!: string

  @StringProperty({
    description: '作者头像URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatar?: string

  @StringProperty({
    description: '作者描述',
    example: '日本著名小说家，代表作有《挪威的森林》等',
    required: false,
  })
  description?: string

  @BooleanProperty({
    description: '启用状态（true: 启用, false: 禁用）',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @ArrayProperty({
    description: '作者角色类型，1 => 漫画家 2 => 小说家',
    example: [AuthorTypeEnum.NOVEL],
    required: true,
    itemType: 'number',
  })
  type!: number[]

  @StringProperty({
    description: '国籍',
    example: '日本',
    required: false,
  })
  nationality?: string

  @EnumProperty({
    description: '性别（0: 未知, 1: 男性, 2: 女性, 3: 其他）',
    example: GenderEnum.MALE,
    required: true,
    enum: GenderEnum,
    default: GenderEnum.UNKNOWN,
  })
  gender!: GenderEnum

  @StringProperty({
    description: '管理员备注',
    example: '优秀作者，作品质量高',
    required: false,
  })
  remark?: string

  @NumberProperty({
    description: '作品数量（冗余字段，用于提升查询性能）',
    example: 10,
    required: true,
    min: 0,
    default: 0,
  })
  workCount!: number

  @NumberProperty({
    description: '粉丝数量（冗余字段，用于前台展示）',
    example: 1000,
    required: true,
    min: 0,
    default: 0,
  })
  followersCount!: number

  @BooleanProperty({
    description: '是否为推荐作者（用于前台推荐展示）',
    example: false,
    required: true,
    default: false,
  })
  isRecommended!: boolean
}
