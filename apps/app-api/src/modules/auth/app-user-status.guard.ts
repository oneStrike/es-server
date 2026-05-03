import { IS_PUBLIC_KEY } from '@libs/platform/decorators'
import { BusinessException } from '@libs/platform/exceptions'
import { AuthErrorMessages } from '@libs/platform/modules/auth/helpers'
import { UserService as UserCoreService } from '@libs/user/user.service'
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

@Injectable()
export class AppUserStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userCoreService: UserCoreService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest<{
      user?: { sub?: number | string }
    }>()
    const userId = Number(request.user?.sub)

    if (!Number.isFinite(userId) || userId <= 0) {
      return true
    }

    const accessCheck = await this.userCoreService.getAppUserAccessCheck(userId)
    if (accessCheck.allowed) {
      return true
    }

    if (accessCheck.reason === 'not_found') {
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    if (accessCheck.reason === 'disabled') {
      throw new ForbiddenException(accessCheck.message)
    }

    throw new BusinessException(accessCheck.code, accessCheck.message)
  }
}
