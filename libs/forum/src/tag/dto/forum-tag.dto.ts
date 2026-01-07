import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, PageDto } from '@libs/base/dto'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'

/**
 * 基础论坛标签 DTO
 * 包含论坛标签的所有基础字段定义
 */
export class BaseForumTagDto extends BaseDto {
  @ValidateString({
    description: '标签名称',
    example: '技术讨论',
    required: true,
    maxLength: 50,
  })
  name!: string

  @ValidateString({
    description: '标签图标URL',
    example: 'https://example.com/icon.png',
    required: false,
    maxLength: 255,
  })
  icon!: string

  @ValidateString({
    description: '标签描述',
    example: '用于标记技术相关的讨论',
    required: false,
    maxLength: 200,
  })
  description?: string

  @ValidateNumber({
    description: '主题ID',
    example: 1,
    required: true,
    min: 1,
  })
  topicId!: number

  @ValidateBoolean({
    description: '是否系统标签',
    example: true,
    required: true,
  })
  isEnabled!: boolean

  @ValidateNumber({
    description: '使用次数',
    example: 100,
    required: false,
    min: 0,
  })
  useCount?: number

  @ValidateNumber({
    description: '排序权重',
    example: 0,
    required: false,
    min: 0,
  })
  sortOrder?: number
}

/**
 * 创建论坛标签 DTO
 * 用于创建新的论坛标签
 */
export class CreateForumTagDto extends PickType(BaseForumTagDto, [
  'icon',
  'name',
  'topicId',
  'description',
  'sortOrder',
]) {}

/**
 * 更新论坛标签 DTO
 * 用于更新现有的论坛标签信息
 */
export class UpdateForumTagDto extends IntersectionType(
  CreateForumTagDto,
  IdDto,
) {}

/**
 * 查询论坛标签 DTO
 * 用于查询论坛标签列表，支持分页和条件筛选
 */
export class QueryForumTagDto extends IntersectionType(
  PageDto,
  PartialType(PickType(BaseForumTagDto, ['name', 'isEnabled'])),
) {}

/**
 * 为主题分配标签 DTO
 * 用于将标签分配给指定的主题
 */
export class AssignTagToTopicDto extends PickType(BaseForumTagDto, [
  'topicId',
]) {
  @ValidateNumber({
    description: '标签ID',
    example: 1,
    required: true,
    min: 1,
  })
  tagId!: number
}

/**
 * 从主题移除标签 DTO
 * 用于从指定主题中移除标签
 */
export class RemoveTagFromTopicDto extends AssignTagToTopicDto {}
