import type { FastifyRequest } from 'fastify'
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common'

const LEGACY_ADMIN_SELF_PROFILE_FIELDS = ['id', 'roleIds', 'isEnabled'] as const

/**
 * 当前管理员资料更新旧字段拒绝守卫。
 */
@Injectable()
export class AdminSelfProfileLegacyFieldsGuard implements CanActivate {
  // 在全局 ValidationPipe 白名单过滤前拒绝账号管理字段。
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const body = request.body
    if (!this.isRecord(body)) {
      return true
    }

    const legacyFields = LEGACY_ADMIN_SELF_PROFILE_FIELDS.filter((field) =>
      Object.hasOwn(body, field),
    )
    if (legacyFields.length > 0) {
      throw new BadRequestException(
        `当前资料接口不允许提交字段：${legacyFields.join('、')}`,
      )
    }
    return true
  }

  // 判断请求体是否为可检查字段的对象。
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}
