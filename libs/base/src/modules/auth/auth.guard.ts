import { AuthConfig } from '@libs/base/config'
import { IS_PUBLIC_KEY } from '@libs/base/decorators'
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { AuthErrorConstant } from './auth.constant'

/**
 * AuthGuard JWT认证守卫
 */
@Injectable()
export class JwtAuthGuard
  extends AuthGuard(AuthConfig.strategyKey)
  implements CanActivate {
  constructor(private reflector: Reflector) {
    super()
  }

  /**
   * 判断当前请求是否可以激活
   * @param context 执行上下文
   * @returns 是否允许访问
   */
  async canActivate(context: ExecutionContext) {
    // 检查路由是否被标记为公共
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // 如果路由被标记为公共，则跳过认证
    if (isPublic) {
      return true
    }

    return (await super.canActivate(context)) as boolean
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new UnauthorizedException(AuthErrorConstant.LOGIN_INVALID)
    }
    return user
  }
}
