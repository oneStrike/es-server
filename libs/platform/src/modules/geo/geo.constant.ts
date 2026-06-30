/**
 * 当前进程属地库来源。
 *
 * 运行时服务与 DTO 文档共用这一组闭集值，避免 DTO 反向依赖内部 type 文件。
 */
export const GEO_RUNTIME_SOURCE = {
  /** 使用管理端上传并已激活的属地库。 */
  MANAGED_ACTIVE: 'managed-active',
  /** 使用显式配置路径中的属地库。 */
  CONFIGURED_PATH: 'configured-path',
  /** 使用默认路径中的属地库。 */
  DEFAULT_PATH: 'default-path',
  /** 当前进程没有可用属地库。 */
  UNAVAILABLE: 'unavailable',
} as const
