import type { AdminCurrentMenuDto } from '@libs/identity/dto/admin-rbac.dto'

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
