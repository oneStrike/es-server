import type { Type } from '@nestjs/common'
import type { AdminPermissionMetadata } from '../../common/decorators/admin-permission.decorator'
import type {
  AdminPermissionDefinition,
  AdminRbacHandler,
} from './admin-rbac.type'
import { IS_PUBLIC_KEY } from '@libs/platform/decorators'
import { Injectable } from '@nestjs/common'
import { DiscoveryService, Reflector } from '@nestjs/core'
import { ADMIN_AUTH_ONLY_KEY, ADMIN_PERMISSION_KEY } from '../../common/decorators/admin-permission.decorator'

// 收窄 controller prototype 上的未知属性，避免把非函数成员当成 handler。
function isAdminRbacHandler(value: unknown): value is AdminRbacHandler {
  return typeof value === 'function'
}

@Injectable()
export class AdminRbacMetadataService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  // 扫描所有 admin controller handler 上声明的权限元数据。
  getPermissionDefinitions(): AdminPermissionDefinition[] {
    const definitions: AdminPermissionDefinition[] = []
    for (const wrapper of this.discoveryService.getControllers()) {
      const instance = wrapper.instance as object | undefined
      if (!instance) {
        continue
      }
      const prototype = Object.getPrototypeOf(instance) as Record<string, unknown> | null
      const controllerClass = instance.constructor as Type<unknown>
      if (!prototype) {
        continue
      }
      for (const handlerName of Object.getOwnPropertyNames(prototype)) {
        if (handlerName === 'constructor') {
          continue
        }
        const handler = prototype[handlerName]
        if (!isAdminRbacHandler(handler)) {
          continue
        }
        const metadata = this.reflector.getAllAndOverride<
          AdminPermissionMetadata,
          string
        >(ADMIN_PERMISSION_KEY, [handler, controllerClass])
        if (!metadata) {
          continue
        }
        definitions.push({
          ...metadata,
          code: metadata.code.trim(),
          groupCode: metadata.groupCode.trim(),
          name: metadata.name.trim(),
          controllerName: controllerClass.name,
          handlerName,
        })
      }
    }
    return definitions
  }

  // 读取当前 handler 对应的权限元数据。
  getHandlerPermission(contextClass: Type<unknown>, handler: unknown) {
    if (!isAdminRbacHandler(handler)) {
      return undefined
    }
    return this.reflector.getAllAndOverride<AdminPermissionMetadata, string>(
      ADMIN_PERMISSION_KEY,
      [handler, contextClass],
    )
  }

  // 判断当前 handler 是否显式公开访问。
  isPublic(contextClass: Type<unknown>, handler: unknown) {
    if (!isAdminRbacHandler(handler)) {
      return undefined
    }
    return this.reflector.getAllAndOverride<boolean, string>(IS_PUBLIC_KEY, [
      handler,
      contextClass,
    ])
  }

  // 判断当前 handler 是否只要求登录、不要求业务权限码。
  isAuthOnly(contextClass: Type<unknown>, handler: unknown) {
    if (!isAdminRbacHandler(handler)) {
      return undefined
    }
    return this.reflector.getAllAndOverride<boolean, string>(
      ADMIN_AUTH_ONLY_KEY,
      [handler, contextClass],
    )
  }
}
