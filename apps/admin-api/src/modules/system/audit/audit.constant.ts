/**
 * 常用操作类型
 */
export enum ActionTypeEnum {
  /** 用户登录 */
  LOGIN = '用户登录',
  /** 用户登出 */
  LOGOUT = '用户登出',
  /** 创建数据 */
  CREATE = '创建数据',
  /** 更新数据 */
  UPDATE = '更新数据',
  /** 删除数据 */
  DELETE = '删除数据',
  /** 文件上传 */
  UPLOAD = '文件上传',
  /** 文件下载 */
  DOWNLOAD = '文件下载',
  /** 数据导出 */
  EXPORT = '数据导出',
  /** 数据导入 */
  IMPORT = '数据导入',
}
