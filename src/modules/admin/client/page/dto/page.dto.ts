import {
  ApiProperty,
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { IdDto } from '@/common/dto/base.dto'
import { PageDto } from '@/common/dto/page.dto'
import {
  ValidateBoolean,
  ValidateEnum,
  ValidateNumber,
  ValidateString,
} from '@/decorators/validate.decorator'
import { PageRuleEnum } from '../page.constant'

/**
 * 页面配置基础字段DTO
 */
export class BaseClientPageDto extends IdDto {
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
    required: false,
    maxLength: 200,
  })
  title?: string

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
 * 更新页面配置DTO
 */
export class UpdateClientPageDto extends PartialType(BaseClientPageDto) {
  @ValidateNumber({
    description: '页面ID',
    example: 1,
    required: true,
  })
  id!: number
}

/**
 * 页面配置查询DTO
 */
export class QueryClientPageDto extends IntersectionType(
  PageDto,
  PickType(PartialType(BaseClientPageDto), [
    'name',
    'code',
    'accessLevel',
    'isEnabled',
  ]),
) {}

/**
 * 页面配置响应DTO
 */
export class ClientPageResponseDto extends IntersectionType(
  BaseClientPageDto,
  IdDto,
) {
  @ApiProperty({
    description: '创建时间',
    example: '2021-01-01 00:00:00',
  })
  createdAt!: Date

  @ApiProperty({
    description: '更新时间',
    example: '2021-01-01 00:00:00',
  })
  updatedAt!: Date
}

/**
 * 页面配置分页响应DTO
 */
export class ClientPagePageResponseDto extends OmitType(ClientPageResponseDto, [
  'description',
]) {}
