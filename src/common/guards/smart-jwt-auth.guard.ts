import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { GUARD_PATH_PREFIXES } from '@/common/constants/auth.constants'
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator'
import { ADMIN_AUTH_CONFIG } from '@/config/jwt.config'

/**
 * SmartJwtAuthGuard 智能JWT认证守卫
 * 根据请求路径自动选择合适的认证策略
 * 解决多个Guard同时执行导致的冲突问题
 */
@Injectable()
export class SmartJwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /**
   * 判断当前请求是否可以激活
   * @param context 执行上下文
   * @returns 是否允许访问
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查路由是否被标记为公共
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // 如果路由被标记为公共，则跳过认证
    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const path: string = request.route?.path || request.url

    // 根据路径前缀选择合适的策略
    if (this.isAdminPath(path)) {
      // 管理员路径使用admin-jwt策略
      const adminGuard = new (AuthGuard(ADMIN_AUTH_CONFIG.strategyKey))()
      return adminGuard.canActivate(context) as Promise<boolean>
    }
    else if (this.isClientPath(path)) {
      // 客户端路径使用client-jwt策略
      const clientGuard = new (AuthGuard('client-jwt'))()
      return clientGuard.canActivate(context) as Promise<boolean>
    }

    // 其他路径默认不需要认证
    return true
  }

  /**
   * 判断是否为管理员路径
   * @param path 请求路径
   * @returns 是否为管理员路径
   */
  private isAdminPath(path: string): boolean {
    return GUARD_PATH_PREFIXES.ADMIN.some(adminPath => path.startsWith(adminPath))
  }

  /**
   * 判断是否为客户端路径
   * @param path 请求路径
   * @returns 是否为客户端路径
   */
  private isClientPath(path: string): boolean {
    return GUARD_PATH_PREFIXES.CLIENT.some(clientPath => path.startsWith(clientPath))
  }
}
