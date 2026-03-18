import { AuthConfig } from '@libs/platform/config'
import { IS_OPTIONAL_AUTH_KEY, IS_PUBLIC_KEY } from '@libs/platform/decorators'
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { AuthErrorMessages } from './auth.constant'

/**
 * AuthGuard JWT认证守卫
 */
@Injectable()
export class JwtAuthGuard
  extends AuthGuard(AuthConfig.strategyKey)
  implements CanActivate
{
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

    // 检查路由是否被标记为可选认证
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    )

    // 如果是可选认证，尝试解析 token 但不强制要求
    if (isOptionalAuth) {
      try {
        return (await super.canActivate(context)) as boolean
      } catch {
        // token 无效或不存在时，允许请求继续，但用户信息为空
        return true
      }
    }

    return (await super.canActivate(context)) as boolean
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // 检查是否为可选认证
    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()],
    )

    // 可选认证时，允许无用户信息
    if (isOptionalAuth) {
      return user
    }

    // 强制认证时，必须有用户信息
    if (err || !user) {
      throw new UnauthorizedException(AuthErrorMessages.LOGIN_INVALID)
    }
    return user
  }
}
