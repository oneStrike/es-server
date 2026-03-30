import type { AppConfigSelect } from '@db/schema'

/**
 * 更新应用配置入参。
 * - 在固定配置记录上按需更新可编辑字段
 */
export type UpdateAppConfigInput = Partial<
  Pick<
    AppConfigSelect,
    | 'appName'
    | 'appDesc'
    | 'appLogo'
    | 'onboardingImage'
    | 'themeColor'
    | 'secondaryColor'
    | 'optionalThemeColors'
    | 'enableMaintenanceMode'
    | 'maintenanceMessage'
    | 'version'
  >
>
