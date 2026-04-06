import { DrizzleService } from '@db/core'
import { IS_PUBLIC_KEY } from '@libs/platform/decorators/public.decorator';
import { AuthErrorMessages } from '@libs/platform/modules/auth/auth.constant';
import { UserService as UserCoreService } from '@libs/user/user.service';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AppAuthErrorMessages } from './auth.constant'

@Injectable()
export class AppUserStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly drizzle: DrizzleService,
    private readonly userCoreService: UserCoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const user = await this.drizzle.db.query.appUser.findFirst({
      where: {
        id: userId,
        deletedAt: { isNull: true },
      },
      columns: {
        id: true,
        isEnabled: true,
        status: true,
        banReason: true,
        banUntil: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    if (!user.isEnabled) {
      throw new BadRequestException(AppAuthErrorMessages.ACCOUNT_DISABLED)
    }

    this.userCoreService.ensureAppUserNotBanned(user)
    return true
  }
}
