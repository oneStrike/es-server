import {
  ValidateArray,
  ValidateBoolean,
  ValidateEnum,
  ValidateJson,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS, PageDto } from '@libs/base/dto'
import { EnablePlatformEnum } from '@libs/base/enum'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { PageRuleEnum } from '../page.constant'

/**
 * 页面配置基础字段DTO
 */
export class BaseClientPageDto extends BaseDto {
  @ValidateString({
    description: '页面编码（唯一标识）',
    example: 'home',
    required: true,
    maxLength: 50,
  })
  code!: string

  @ValidateString({
    description: '页面路径（URL路径）',
    example: '/home',
    required: true,
    maxLength: 300,
  })
  path!: string

  @ValidateString({
    description: '页面名称',
    example: '首页',
    required: true,
    maxLength: 100,
  })
  name!: string

  @ValidateString({
    description: '页面标题',
    example: '首页 - 我的应用',
    required: true,
    maxLength: 200,
  })
  title!: string

  @ValidateArray({
    description: '启用的平台',
    example: [EnablePlatformEnum.APP],
    required: true,
    itemType: 'number',
  })
  enablePlatform!: EnablePlatformEnum[]

  @ValidateEnum({
    description: '页面权限级别',
    example: PageRuleEnum.GUEST,
    required: true,
    enum: PageRuleEnum,
    default: PageRuleEnum.GUEST,
  })
  accessLevel!: PageRuleEnum

  @ValidateBoolean({
    description: '页面启用状态',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @ValidateString({
    description: '页面描述信息',
    example: '应用首页，展示主要功能和内容',
    required: false,
    maxLength: 500,
  })
  description?: string
}

/**
 * 页面配置创建DTO
 */
export class CreateClientPageDto extends OmitType(
  BaseClientPageDto,
  OMIT_BASE_FIELDS,
) {}

/**
 * 更新页面配置DTO
 */
export class UpdateClientPageDto extends IntersectionType(
  PartialType(CreateClientPageDto),
  IdDto,
) {}

/**
 * 页面配置查询DTO
 */
export class QueryClientPageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseClientPageDto, ['name', 'code', 'accessLevel', 'isEnabled']),
  ),
) {
  @ValidateJson({
    description: '所启用的平台',
    example: '[1,2,3]',
    required: false,
  })
  enablePlatform?: string
}

/**
 * 页面配置分页响应DTO
 */
export class ClientPageResponseDto extends OmitType(BaseClientPageDto, [
  'description',
]) {}
