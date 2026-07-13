/**
 * 可由离线 reference bootstrap 复用的管理端权限最小定义。
 *
 * controller 扫描得到的运行时定义会在应用层追加来源 handler 信息；这里不耦合
 * Nest 元数据，确保空库 bootstrap 能在不启动应用的情况下构建完整 RBAC 基线。
 */
export interface AdminReferencePermission {
  code: string
  name: string
  groupCode: string
  description?: string
}
