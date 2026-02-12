/**
 * 应用配置默认值
 * 用于初始化配置或缺省值回退
 */
/// 默认应用配置数据
export const DEFAULT_APP_CONFIG = {
  /** 应用名称 */
  appName: '默认应用',
  /** 应用描述 */
  appDesc: '这是一个默认的应用配置',
  /** 应用 Logo */
  appLogo: '',
  /** 引导页图片 */
  onboardingImage: '',
  /** 主色 */
  themeColor: '#007AFF',
  /** 辅色 */
  secondaryColor: '#5856D6',
  /** 可选主题色列表（逗号分隔） */
  optionalThemeColors: '#FF9500,#FF3B30,#4CD964,#5AC8FA,#007AFF',
  /** 是否启用维护模式 */
  enableMaintenanceMode: false,
  /** 维护提示文案 */
  maintenanceMessage: '系统维护中，请稍后再试',
  /** 配置版本号 */
  version: '1.0.0',
} as const
