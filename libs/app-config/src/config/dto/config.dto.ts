import {
  ValidateBoolean,
  ValidateNumber,
  ValidateString,
} from '@libs/base/decorators'
import { BaseDto, } from '@libs/base/dto'
import {
  OmitType,
} from '@nestjs/swagger'
import { APP_CONFIG_CONSTANTS } from '../config.constant'

/// 应用配置基础字段DTO
export class BaseAppConfigDto extends BaseDto {
  @ValidateString({
    description: '应用名称',
    example: '我的应用',
    required: true,
    maxLength: APP_CONFIG_CONSTANTS.MAX_APP_NAME_LENGTH,
  })
  appName!: string

  @ValidateString({
    description: '应用描述',
    example: '这是一个示例应用',
    required: false,
    maxLength: APP_CONFIG_CONSTANTS.MAX_APP_DESC_LENGTH,
  })
  appDesc?: string

  @ValidateString({
    description: '应用Logo URL',
    example: 'https://example.com/logo.png',
    required: false,
    maxLength: APP_CONFIG_CONSTANTS.MAX_LOGO_URL_LENGTH,
  })
  appLogo?: string

  @ValidateString({
    description: '引导页图片 URL',
    example: 'https://example.com/onboarding.jpg',
    required: false,
    maxLength: APP_CONFIG_CONSTANTS.MAX_ONBOARDING_IMAGE_LENGTH,
  })
  onboardingImage?: string

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
    maxLength: APP_CONFIG_CONSTANTS.MAX_MAINTENANCE_MESSAGE_LENGTH,
  })
  maintenanceMessage?: string

  @ValidateString({
    description: '配置版本号',
    example: '1.0.0',
    required: true,
    default: APP_CONFIG_CONSTANTS.DEFAULT_VERSION,
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
  'createdAt',
  'updatedAt',
  'updatedById',
]) { }
