import type { DbExecutor, DbTransaction } from '@db/core'
import type { AdminRoleSelect } from '@db/schema'
import type { AdminReferencePermission } from '@libs/identity/admin-rbac.reference'
import type { AdminCurrentMenuDto } from '@libs/identity/dto/admin-rbac.dto'
import type { AdminPermissionMetadata } from '../../common/decorators/admin-permission.decorator'

/** 管理端 RBAC 可查询上下文；只读 helper 可以接受根客户端或事务客户端。 */
export type AdminRbacDb = DbExecutor

/** 管理端 RBAC 写入事务上下文；完整性锁和跨表写入不得退化为根客户端。 */
export type AdminRbacTransaction = DbTransaction

/** 后端装饰器扫描得到的管理端权限定义。 */
export interface AdminPermissionDefinition
  extends AdminReferencePermission, AdminPermissionMetadata {
  controllerName: string
  handlerName: string
}

/** 管理端权限元数据扫描只接受函数式 controller handler。 */
export type AdminRbacHandler = (...args: unknown[]) => unknown

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
