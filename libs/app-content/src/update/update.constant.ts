/**
 * App 更新平台枚举。
 */
export enum AppUpdatePlatformEnum {
  IOS = 1,
  ANDROID = 2,
}

/**
 * 安装包来源枚举。
 */
export enum AppUpdatePackageSourceEnum {
  UPLOAD = 1,
  URL = 2,
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
  /** 居中（默认） */
  CENTER = 'center',
  /** 顶部居中 */
  TOP_CENTER = 'top center',
  /** 顶部靠左 */
  TOP_LEFT = 'top left',
  /** 顶部靠右 */
  TOP_RIGHT = 'top right',
  /** 底部居中 */
  BOTTOM_CENTER = 'bottom center',
  /** 底部靠左 */
  BOTTOM_LEFT = 'bottom left',
  /** 底部靠右 */
  BOTTOM_RIGHT = 'bottom right',
  /** 左侧居中 */
  LEFT_CENTER = 'left center',
  /** 右侧居中 */
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
export const APP_UPDATE_CHANNEL_CODE_REGEXP = /^[a-z0-9][\w-]{0,49}$/i
