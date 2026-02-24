import {
  BooleanProperty,
  NumberProperty,
  StringProperty,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'

/**
 * 论坛板块分组基础DTO
 */
export class BaseForumSectionGroupDto extends BaseDto {
  @StringProperty({
    description: '分组名称',
    example: '技术讨论',
    required: true,
    maxLength: 50,
  })
  name!: string

  @StringProperty({
    description: '分组描述',
    example: '包含所有技术相关的板块',
    required: false,
    maxLength: 500,
  })
  description?: string

  @NumberProperty({
    description: '排序权重',
    example: 0,
    required: true,
    min: 0,
    default: 0,
  })
  sortOrder!: number

  @BooleanProperty({
    description: '是否启用',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean
}

/**
 * 创建论坛板块分组DTO
 */
export class CreateForumSectionGroupDto extends OmitType(
  BaseForumSectionGroupDto,
  [...OMIT_BASE_FIELDS],
) {}

/**
 * 更新论坛板块分组DTO
 */
export class UpdateForumSectionGroupDto extends IntersectionType(
  PartialType(CreateForumSectionGroupDto),
  IdDto,
) {}

/**
 * 查询论坛板块分组DTO
 */
export class QueryForumSectionGroupDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumSectionGroupDto, ['name', 'isEnabled'])),
) {}
