import { DrizzleService } from '@db/core'
import { IS_PUBLIC_KEY } from '@libs/platform/decorators/public.decorator'
import { AuthErrorMessages } from '@libs/platform/modules/auth/auth.constant'
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { eq } from 'drizzle-orm'

@Injectable()
export class AdminUserStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly drizzle: DrizzleService,
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

    const [user] = await this.drizzle.db
      .select({
        id: this.drizzle.schema.adminUser.id,
        isEnabled: this.drizzle.schema.adminUser.isEnabled,
      })
      .from(this.drizzle.schema.adminUser)
      .where(eq(this.drizzle.schema.adminUser.id, userId))
      .limit(1)

    if (!user) {
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }

    if (!user.isEnabled) {
      throw new ForbiddenException('账号已被禁用，请联系管理员。')
    }

    return true
  }
}
