import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, OMIT_BASE_FIELDS } from '@libs/base/dto'
import { OmitType } from '@nestjs/swagger'

/// 应用配置基础字段DTO
export class BaseAppConfigDto extends BaseDto {
  @ValidateString({
    description: '应用名称',
    example: '我的应用',
    required: true,
    maxLength: 100,
  })
  appName!: string

  @ValidateString({
    description: '应用描述',
    example: '这是一个示例应用',
    required: false,
    maxLength: 500,
  })
  appDesc?: string

  @ValidateString({
    description: '应用Logo URL',
    example: 'https://example.com/logo.png',
    required: false,
    maxLength: 500,
  })
  appLogo?: string

  @ValidateString({
    description: '引导页图片 URL',
    example: 'https://example.com/onboarding.jpg',
    required: false,
    maxLength: 500,
  })
  onboardingImage?: string

  @ValidateString({
    description: '主题色',
    example: '#007AFF',
    required: true,
    default: '#007AFF',
    maxLength: 20,
  })
  themeColor!: string

  @ValidateString({
    description: '第二主题色(可选)',
    example: '#5856D6',
    required: false,
    maxLength: 20,
  })
  secondaryColor?: string

  @ValidateString({
    description: '可选的主题色',
    example: '#FF9500,#FF3B30,#4CD964,#5AC8FA,#007AFF',
    required: false,
    maxLength: 500,
  })
  optionalThemeColors?: string

  @ValidateBoolean({
    description: '是否启用维护模式',
    example: false,
    required: true,
    default: false,
  })
  enableMaintenanceMode!: boolean

  @ValidateString({
    description: '维护模式提示信息',
    example: '系统维护中，请稍后再试',
    required: false,
    maxLength: 500,
  })
  maintenanceMessage?: string

  @ValidateString({
    description: '配置版本号',
    example: '1.0.0',
    required: true,
    default: '1.0.0',
  })
  version!: string

  @ValidateNumber({
    description: '最后修改人ID',
    example: 1,
    required: false,
  })
  updatedById?: number
}

/// 更新应用配置DTO
export class UpdateAppConfigDto extends OmitType(BaseAppConfigDto, [
  ...OMIT_BASE_FIELDS,
  'updatedById',
]) {}
