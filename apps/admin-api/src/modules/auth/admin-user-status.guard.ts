import type { CurrentUserRequest } from '@libs/platform/decorators'
import { IS_PUBLIC_KEY } from '@libs/platform/decorators'
import { AuthErrorMessages } from '@libs/platform/modules/auth/helpers'
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AdminAuthAccountService } from './admin-auth-account.service'

@Injectable()
export class AdminUserStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminAuthAccountService: AdminAuthAccountService,
  ) {}

  // 对已认证管理员检查账号仍然存在且处于启用状态。
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<CurrentUserRequest>()
    const userId = Number(request.user?.sub)
    if (!Number.isFinite(userId) || userId <= 0) {
      return true
    }

    const user = await this.adminAuthAccountService.findAdminUserStatus(userId)

    if (!user) {
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    if (!user.isEnabled) {
      throw new ForbiddenException('账号已被禁用，请联系管理员。')
    }

    return true
  }
}
