/**
 * 常用操作类型。
 */
export enum AuditActionTypeEnum {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  UPLOAD = 'UPLOAD',
  DOWNLOAD = 'DOWNLOAD',
  EXPORT = 'EXPORT',
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
