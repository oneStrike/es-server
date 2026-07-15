/** 管理端权限元数据扫描只接受函数式 controller handler。 */
export type AdminRbacHandler = (...args: unknown[]) => unknown
