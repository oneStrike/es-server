import { EnablePlatformEnum } from '@libs/platform/constant'
import {
  ArrayProperty,
  BooleanProperty,
  EnumProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto } from '@libs/platform/dto'
import { PageRuleEnum } from '../page.constant'

/**
 * 页面配置基础字段DTO
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
    description: '页面路径（URL路径）',
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

  @ArrayProperty({
    description: '启用的平台',
    example: [EnablePlatformEnum.APP],
    required: false,
    itemType: 'number',
  })
  enablePlatform?: EnablePlatformEnum[] | null

  @EnumProperty({
    description: '页面权限级别',
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
  description?: string
}
