import { EnablePlatformEnum } from '@libs/platform/constant/base.constant';
import { ArrayProperty } from '@libs/platform/decorators/validate/array-property';
import { BooleanProperty } from '@libs/platform/decorators/validate/boolean-property';
import { EnumArrayProperty } from '@libs/platform/decorators/validate/enum-array-property';
import { EnumProperty } from '@libs/platform/decorators/validate/enum-property';
import { JsonProperty } from '@libs/platform/decorators/validate/json-property';
import { StringProperty } from '@libs/platform/decorators/validate/string-property';
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto';
import { PageDto } from '@libs/platform/dto/page.dto';
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import { PageRuleEnum } from '../page.constant'

/**
 * 页面配置基础字段 DTO
 */
export class BaseAppPageDto extends BaseDto {
  @StringProperty({
    description: '页面编码（唯一标识）',
    example: 'home',
    required: true,
    maxLength: 50,
  })
  code!: string

  @StringProperty({
    description: '页面路径（URL 路径）',
    example: '/home',
    required: true,
    maxLength: 300,
  })
  path!: string

  @StringProperty({
    description: '页面名称',
    example: '首页',
    required: true,
    maxLength: 100,
  })
  name!: string

  @StringProperty({
    description: '页面标题',
    example: '首页 - 我的应用',
    required: true,
    maxLength: 200,
  })
  title!: string

  @EnumArrayProperty({
    description: '启用的平台（1=H5；2=App；3=小程序）',
    example: [EnablePlatformEnum.APP],
    required: false,
    enum: EnablePlatformEnum,
  })
  enablePlatform?: EnablePlatformEnum[] | null

  @EnumProperty({
    description: '页面权限级别（0=游客；1=登录；2=会员；3=高级会员）',
    example: PageRuleEnum.GUEST,
    required: true,
    enum: PageRuleEnum,
    default: PageRuleEnum.GUEST,
  })
  accessLevel!: PageRuleEnum

  @BooleanProperty({
    description: '页面启用状态',
    example: true,
    required: true,
    default: true,
  })
  isEnabled!: boolean

  @StringProperty({
    description: '页面描述信息',
    example: '应用首页，展示主要功能和内容',
    required: false,
    maxLength: 500,
  })
  description?: string | null
}

export class CreateAppPageDto extends OmitType(BaseAppPageDto, [
  ...OMIT_BASE_FIELDS,
] as const) {}

export class UpdateAppPageDto extends IntersectionType(
  IdDto,
  PartialType(CreateAppPageDto),
) {}

export class QueryAppPageDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAppPageDto, [
      'name',
      'code',
      'accessLevel',
      'isEnabled',
    ] as const),
  ),
) {
  @JsonProperty({
    description: '启用平台筛选 JSON 字符串，例如 [1,2]',
    example: '[1,2]',
    required: false,
  })
  enablePlatform?: string
}

export class QueryPageByCodeDto extends PickType(BaseAppPageDto, [
  'code',
] as const) {}
