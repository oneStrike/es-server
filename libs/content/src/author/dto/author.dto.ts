import { GenderEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  JsonProperty,
  NumberProperty,
  StringProperty,
} from '@libs/platform/decorators'

import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/platform/dto'

import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { AuthorTypeEnum } from '../author.constant'

/**
 * 作者基础 DTO
 */
export class BaseAuthorDto extends BaseDto {
  @StringProperty({
    description: '作者姓名',
    example: '村上春树',
    required: true,
    maxLength: 100,
  })
  name!: string

  @StringProperty({
    description: '作者头像 URL',
    example: 'https://example.com/avatar.jpg',
    nullable: true,
    maxLength: 500,
  })
  avatar!: string | null

  @StringProperty({
    description: '作者描述',
    example: '日本著名小说家，代表作有《挪威的森林》等',
    nullable: true,
    maxLength: 1000,
  })
  description!: string | null

  @BooleanProperty({
    description: '启用状态',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @ArrayProperty({
    description: '作者角色类型（1=漫画家；2=轻小说作者）',
    example: [AuthorTypeEnum.NOVEL],
    nullable: true,
    itemEnum: AuthorTypeEnum,
  })
  type!: AuthorTypeEnum[] | null

  @StringProperty({
    description: '国籍',
    example: '日本',
    nullable: true,
    maxLength: 50,
  })
  nationality!: string | null

  @EnumProperty({
    description: '性别（0=未知；1=男性；2=女性；3=其他；4=保密）',
    example: GenderEnum.MALE,
    required: true,
    enum: GenderEnum,
    default: GenderEnum.UNKNOWN,
  })
  gender!: GenderEnum

  @StringProperty({
    description: '管理员备注',
    example: '优秀作者，作品质量高',
    nullable: true,
    maxLength: 1000,
  })
  remark!: string | null

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

  @DateProperty({
    description: '删除时间',
    example: '2026-03-27T00:00:00.000Z',
    required: false,
    validation: false,
    contract: false,
  })
  deletedAt?: Date | null
}

class CreateAuthorRequiredFieldsDto extends OmitType(BaseAuthorDto, [
  ...OMIT_BASE_FIELDS,
  'avatar',
  'description',
  'type',
  'nationality',
  'remark',
  'workCount',
  'isEnabled',
  'isRecommended',
  'followersCount',
] as const) {}

class CreateAuthorOptionalFieldsDto extends PartialType(
  PickType(BaseAuthorDto, [
    'avatar',
    'description',
    'type',
    'nationality',
    'remark',
  ] as const),
) {}

export class CreateAuthorDto extends IntersectionType(
  CreateAuthorRequiredFieldsDto,
  CreateAuthorOptionalFieldsDto,
) {}

export class UpdateAuthorDto extends IntersectionType(
  IdDto,
  PartialType(CreateAuthorDto),
) {}

export class QueryAuthorDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAuthorDto, [
      'name',
      'isEnabled',
      'nationality',
      'gender',
      'isRecommended',
    ] as const),
  ),
) {
  @JsonProperty({
    description: '作者角色类型筛选 JSON 字符串，例如 [1,2]',
    example: '[1,2]',
    required: false,
  })
  type?: string
}

export class UpdateAuthorRecommendedDto extends IntersectionType(
  PickType(BaseAuthorDto, ['isRecommended'] as const),
  IdDto,
) {}

export class UpdateAuthorStatusDto extends IntersectionType(
  PickType(BaseAuthorDto, ['isEnabled'] as const),
  IdDto,
) {}

export class AuthorFollowCountRepairResultDto extends IntersectionType(
  IdDto,
  PickType(BaseAuthorDto, ['followersCount'] as const),
) {}

export class AuthorWorkCountRepairResultDto extends IntersectionType(
  IdDto,
  PickType(BaseAuthorDto, ['workCount'] as const),
) {}

export class AuthorNullableOutputFieldsDto extends PickType(BaseAuthorDto, [
  'avatar',
  'description',
  'type',
  'nationality',
  'remark',
] as const) {}

export class AuthorOutputBaseDto extends OmitType(BaseAuthorDto, [
  'deletedAt',
] as const) {}

export class AuthorPageResponseDto extends OmitType(AuthorOutputBaseDto, [
  'remark',
  'description',
] as const) {}
