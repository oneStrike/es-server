/**
 * 版主权限枚举
 */
export enum ModeratorPermissionEnum {
  /** 置顶权限 */
  PIN = 1,
  /** 加精权限 */
  FEATURE = 2,
  /** 锁定权限 */
  LOCK = 4,
  /** 删除权限 */
  DELETE = 8,
  /** 审核权限 */
  AUDIT = 16,
  /** 移动权限 */
  MOVE = 32,
}

/**
 * 版主权限名称映射
 */
export const ModeratorPermissionNames: Record<ModeratorPermissionEnum, string> = {
  [ModeratorPermissionEnum.PIN]: '置顶',
  [ModeratorPermissionEnum.FEATURE]: '加精',
  [ModeratorPermissionEnum.LOCK]: '锁定',
  [ModeratorPermissionEnum.DELETE]: '删除',
  [ModeratorPermissionEnum.AUDIT]: '审核',
  [ModeratorPermissionEnum.MOVE]: '移动',
}

/**
 * 版主权限列表
 */
export const ModeratorPermissionList = Object.values(ModeratorPermissionEnum).filter(
  (value) => typeof value === 'number',
) as ModeratorPermissionEnum[]

/**
 * 检查是否有指定权限
 * @param permissionMask 权限位掩码
 * @param permission 权限
 * @returns 是否有权限
 */
export function hasPermission(permissionMask: number, permission: ModeratorPermissionEnum): boolean {
  return (permissionMask & permission) === permission
}

/**
 * 添加权限
 * @param permissionMask 权限位掩码
 * @param permission 权限
 * @returns 新的权限位掩码
 */
export function addPermission(permissionMask: number, permission: ModeratorPermissionEnum): number {
  return permissionMask | permission
}

/**
 * 移除权限
 * @param permissionMask 权限位掩码
 * @param permission 权限
 * @returns 新的权限位掩码
 */
export function removePermission(permissionMask: number, permission: ModeratorPermissionEnum): number {
  return permissionMask & ~permission
}
