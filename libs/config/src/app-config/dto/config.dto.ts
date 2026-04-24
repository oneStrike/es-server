import { BooleanProperty, NumberProperty, StringProperty } from '@libs/platform/decorators';

import { BaseDto, OMIT_BASE_FIELDS } from '@libs/platform/dto';
import { OmitType } from '@nestjs/swagger'

/**
 * 应用配置基础 DTO
 */
export class BaseAppConfigDto extends BaseDto {
  @StringProperty({
    description: '应用名称',
    example: '我的应用',
    required: true,
    maxLength: 100,
  })
  appName!: string

  @StringProperty({
    description: '应用描述',
    example: '这是一个示例应用',
    required: false,
    maxLength: 500,
  })
  appDesc?: string | null

  @StringProperty({
    description: '应用 Logo URL',
    example: 'https://example.com/logo.png',
    required: false,
    maxLength: 500,
  })
  appLogo?: string | null

  @StringProperty({
    description: '引导页图片 URL',
    example: 'https://example.com/onboarding.jpg',
    required: false,
    maxLength: 1000,
  })
  onboardingImage?: string | null

  @StringProperty({
    description: '主题色',
    example: '#007AFF',
    required: true,
    default: '#007AFF',
    maxLength: 20,
  })
  themeColor!: string

  @StringProperty({
    description: '第二主题色',
    example: '#5856D6',
    required: false,
    maxLength: 20,
  })
  secondaryColor?: string | null

  @StringProperty({
    description: '可选的主题色',
    example: '#FF9500,#FF3B30,#4CD964,#5AC8FA,#007AFF',
    required: false,
    maxLength: 500,
  })
  optionalThemeColors?: string | null

  @BooleanProperty({
    description: '是否启用维护模式',
    example: false,
    required: true,
    default: false,
  })
  enableMaintenanceMode!: boolean

  @StringProperty({
    description: '维护模式提示信息',
    example: '系统维护中，请稍后再试',
    required: false,
    maxLength: 500,
  })
  maintenanceMessage?: string | null

  @StringProperty({
    description: '配置版本号',
    example: '1.0.0',
    required: true,
    default: '1.0.0',
    maxLength: 50,
  })
  version!: string

  @NumberProperty({
    description: '最后修改人ID',
    example: 1,
    required: false,
  })
  updatedById?: number | null
}

export class UpdateAppConfigDto extends OmitType(BaseAppConfigDto, [
  ...OMIT_BASE_FIELDS,
  'updatedById',
] as const) {}
