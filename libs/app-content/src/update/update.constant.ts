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
 * 更新弹窗背景图片位置枚举。
 * 语义与公告弹窗保持一致，前端可直接映射到 CSS `background-position`。
 */
export enum AppUpdatePopupBackgroundPositionEnum {
  CENTER = 'center',
  TOP_CENTER = 'top center',
  TOP_LEFT = 'top left',
  TOP_RIGHT = 'top right',
  BOTTOM_CENTER = 'bottom center',
  BOTTOM_LEFT = 'bottom left',
  BOTTOM_RIGHT = 'bottom right',
  LEFT_CENTER = 'left center',
  RIGHT_CENTER = 'right center',
}

/**
 * 默认兜底渠道编码。
 */
export const DEFAULT_APP_UPDATE_CHANNEL_CODE = 'default'

/**
 * App 更新渠道字典编码。
 */
export const APP_UPDATE_CHANNEL_DICTIONARY_CODE = 'app_update_channel'

/**
 * 商店渠道编码格式。
 * 使用小写英数、下划线和中划线，便于客户端稳定透传。
 */
export const APP_UPDATE_CHANNEL_CODE_REGEXP = /^[a-z0-9][a-z0-9_-]{0,49}$/i
