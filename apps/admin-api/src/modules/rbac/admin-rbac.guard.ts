import type { CurrentUserRequest } from '@libs/platform/decorators'
import { AdminRbacService } from '@libs/identity/admin-rbac.service'
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { AdminRbacMetadataService } from './admin-rbac-metadata.service'

@Injectable()
export class AdminRbacGuard implements CanActivate {
  constructor(
    private readonly metadataService: AdminRbacMetadataService,
    private readonly rbacService: AdminRbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler()
    const contextClass = context.getClass()
    if (this.metadataService.isPublic(contextClass, handler)) {
      return true
    }
    if (this.metadataService.isAuthOnly(contextClass, handler)) {
      return true
    }
    const permission = this.metadataService.getHandlerPermission(
      contextClass,
      handler,
    )
    if (!permission) {
      throw new ForbiddenException('缺少管理端权限元数据')
    }

    const request = context.switchToHttp().getRequest<CurrentUserRequest>()
    const adminUserId = Number(request.user?.sub)
    if (!Number.isFinite(adminUserId) || adminUserId <= 0) {
      throw new ForbiddenException('无效的管理端用户身份')
    }

    const snapshot = await this.rbacService.getSubjectSnapshot(adminUserId)
    if (snapshot.isSuperAdmin) {
      return true
    }
    if (snapshot.permissionCodes.includes(permission.code)) {
      return true
    }
    throw new ForbiddenException('权限不足')
  }
}
