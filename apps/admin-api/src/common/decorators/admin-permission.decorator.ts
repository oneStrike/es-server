import { SetMetadata } from '@nestjs/common'

export const ADMIN_PERMISSION_KEY = 'admin:permission'
export const ADMIN_AUTH_ONLY_KEY = 'admin:auth-only'

export interface AdminPermissionMetadata {
  code: string
  name: string
  groupCode: string
  description?: string
}

export function AdminPermission(metadata: AdminPermissionMetadata) {
  return SetMetadata(ADMIN_PERMISSION_KEY, metadata)
}

export function AdminAuthOnly() {
  return SetMetadata(ADMIN_AUTH_ONLY_KEY, true)
}
