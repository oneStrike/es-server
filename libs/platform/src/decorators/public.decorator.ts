import { SetMetadata } from '@nestjs/common'

/**
 * 用于标记公共路由的元数据键
 * 被标记为公共的路由将跳过 JWT 鉴权
 */
export const IS_PUBLIC_KEY = 'isPublic'

/**
 * 用于标记可选认证路由的元数据键
 * 被标记为可选认证的路由会尝试解析 token，但不强制要求
 */
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth'

/**
 * Public 装饰器
 * 用于标记不需要 JWT 鉴权的公共路由
 * 可以应用于控制器方法或整个控制器类
 *
 * 示例:
 * @Public()
 * @Get('login')
 * login() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

/**
 * OptionalAuth 装饰器
 * 用于标记可选认证的路由
 * 如果请求携带有效的 JWT token，会解析并注入用户信息
 * 如果没有 token 或 token 无效，请求仍可继续，但用户信息为空
 *
 * 适用场景：
 * - 内容详情页：登录用户显示收藏/点赞状态，未登录用户显示基础内容
 * - 商品详情：登录用户显示个性化推荐，未登录用户显示默认内容
 *
 * 示例:
 * @OptionalAuth()
 * @Get('detail')
 * getDetail(@CurrentUser('sub') userId?: number) { ... }
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true)
