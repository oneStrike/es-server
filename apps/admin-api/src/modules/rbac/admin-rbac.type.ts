import type { Db } from '@db/core'
import type { AdminRoleSelect } from '@db/schema'
import type { AdminMenuType } from '@libs/identity/admin-rbac.constant'
import type { AdminCurrentMenuDto } from '@libs/identity/dto/admin-rbac.dto'
import type { AdminPermissionMetadata } from '../../common/decorators/admin-permission.decorator'

/** 管理端 RBAC 事务上下文，统一复用 DrizzleService 提供的数据库类型。 */
export type AdminRbacDb = Db

/** 后端装饰器扫描得到的管理端权限定义。 */
export interface AdminPermissionDefinition extends AdminPermissionMetadata {
  controllerName: string
  handlerName: string
}

/** 管理端权限元数据扫描只接受函数式 controller handler。 */
export type AdminRbacHandler = (...args: unknown[]) => unknown

/** 管理端首次 bootstrap 使用的默认菜单配置。 */
export interface AdminDefaultMenu {
  /** 菜单编码。 */
  code: string
  /** 父级菜单编码。 */
  parentCode?: string
  /** 菜单类型（1=目录，2=菜单）。 */
  type: AdminMenuType
  /** 菜单标题。 */
  title: string
  /** 路由路径。 */
  path: string
  /** 路由名称。 */
  name: string
  /** 前端组件键。 */
  component?: string
  /** 重定向路径。 */
  redirect?: string
  /** 菜单图标。 */
  icon?: string
  /** 排序值。 */
  sortOrder: number
  /** 是否显示。 */
  isVisible?: boolean
  /** 是否缓存页面。 */
  keepAlive?: boolean
}

/** 菜单树组装所需的最小节点结构。 */
export interface AdminMenuTreeNode<TNode> {
  id: number
  parentId: number | null
  sortOrder: number
  children: TNode[]
}

/** 角色删除保护只需要系统标记和角色编码。 */
export type AdminMutableRole = Pick<AdminRoleSelect, 'isSystem' | 'code'>

/** 原生 SQL execute 返回行结构。 */
export interface AdminExecutedRowsResult<T> {
  rows: T[] | null | undefined
}

/** 管理端 RBAC subject 缓存快照。 */
export interface AdminRbacSubjectSnapshot {
  adminUserId: number
  revision: number
  roleCodes: string[]
  isSuperAdmin: boolean
  permissionCodes: string[]
  menuCodes: string[]
  menus: AdminCurrentMenuDto[]
  expiresAt: number
}
