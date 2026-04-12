/**
 * App 更新平台枚举。
 */
export enum AppUpdatePlatformEnum {
  IOS = 'ios',
  ANDROID = 'android',
}

/**
 * 安装包来源枚举。
 */
export enum AppUpdatePackageSourceEnum {
  UPLOAD = 'upload',
  URL = 'url',
}

/**
 * App 更新类型枚举。
 */
export enum AppUpdateTypeEnum {
  OPTIONAL = 'optional',
  FORCE = 'force',
}

/**
 * 默认兜底渠道编码。
 */
export const DEFAULT_APP_UPDATE_CHANNEL_CODE = 'default'

/**
 * 商店渠道编码格式。
 * 使用小写英数、下划线和中划线，便于客户端稳定透传。
 */
export const APP_UPDATE_CHANNEL_CODE_REGEXP = /^[a-z0-9][a-z0-9_-]{0,49}$/i
