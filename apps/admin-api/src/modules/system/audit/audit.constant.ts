/**
 * 常用操作类型
 */
export enum AuditActionTypeEnum {
  /** 用户登录 */
  LOGIN = 'LOGIN',
  /** 用户登出 */
  LOGOUT = 'LOGOUT',
  /** 创建数据 */
  CREATE = 'CREATE',
  /** 更新数据 */
  UPDATE = 'UPDATE',
  /** 删除数据 */
  DELETE = 'DELETE',
  /** 文件上传 */
  UPLOAD = 'UPLOAD',
  /** 文件下载 */
  DOWNLOAD = 'DOWNLOAD',
  /** 数据导出 */
  EXPORT = 'EXPORT',
  /** 数据导入 */
  IMPORT = 'IMPORT',
}

export const AuditActionTypeLabels: Readonly<Record<AuditActionTypeEnum, string>> =
  {
    [AuditActionTypeEnum.LOGIN]: '用户登录',
    [AuditActionTypeEnum.LOGOUT]: '用户登出',
    [AuditActionTypeEnum.CREATE]: '创建数据',
    [AuditActionTypeEnum.UPDATE]: '更新数据',
    [AuditActionTypeEnum.DELETE]: '删除数据',
    [AuditActionTypeEnum.UPLOAD]: '文件上传',
    [AuditActionTypeEnum.DOWNLOAD]: '文件下载',
    [AuditActionTypeEnum.EXPORT]: '数据导出',
    [AuditActionTypeEnum.IMPORT]: '数据导入',
  }
