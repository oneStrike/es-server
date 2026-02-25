import type { ExecutionContext } from '@nestjs/common'
import { extractIpAddress, parseDeviceInfo } from '@libs/base/utils'
import { createParamDecorator } from '@nestjs/common'

/**
 * 请求元信息接口
 */
export interface RequestMetaResult {
  /** 客户端 IP 地址 */
  ip: string | undefined
  /** 设备 ID (基于 User-Agent 解析) */
  deviceId: string | undefined
}

/**
 * RequestMeta 装饰器
 * 用于从请求中提取 IP 地址和设备信息
 *
 * @example
 * ```typescript
 * @Post('view')
 * async viewComic(
 *   @Body() body: IdDto,
 *   @CurrentUser() user: JwtUserInfoInterface,
 *   @RequestMeta() meta, // 类型自动推导为 RequestMetaResult
 * ) {
 *   return this.workService.incrementViewCount(body.id, user.sub, meta.ip, meta.deviceId)
 * }
 * ```
 */
export const RequestMeta = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestMetaResult => {
    const request = ctx.switchToHttp().getRequest()
    return {
      ip: extractIpAddress(request),
      deviceId: parseDeviceInfo(request.headers['user-agent']),
    }
  },
)
