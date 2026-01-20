/// 应用配置相关常量
export const APP_CONFIG_CONSTANTS = {
  DEFAULT_VERSION: '1.0.0',
  MAX_APP_NAME_LENGTH: 100,
  MAX_APP_DESC_LENGTH: 500,
  MAX_LOGO_URL_LENGTH: 500,
  MAX_ONBOARDING_IMAGE_LENGTH: 1000,
  MAX_MAINTENANCE_MESSAGE_LENGTH: 500,
} as const

/// 默认应用配置数据
export const DEFAULT_APP_CONFIG = {
  appName: '默认应用',
  appDesc: '这是一个默认的应用配置',
  appLogo: '',
  onboardingImage: '',
  enableMaintenanceMode: false,
  maintenanceMessage: '系统维护中，请稍后再试',
  version: APP_CONFIG_CONSTANTS.DEFAULT_VERSION,
} as const
