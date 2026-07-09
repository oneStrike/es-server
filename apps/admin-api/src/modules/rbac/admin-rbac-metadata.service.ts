import type { Type } from '@nestjs/common'
import type { AdminPermissionMetadata } from '../../common/decorators/admin-permission.decorator'
import { IS_PUBLIC_KEY } from '@libs/platform/decorators'
import { Injectable } from '@nestjs/common'
import { DiscoveryService, Reflector } from '@nestjs/core'
import { ADMIN_AUTH_ONLY_KEY, ADMIN_PERMISSION_KEY } from '../../common/decorators/admin-permission.decorator'

export interface AdminPermissionDefinition extends AdminPermissionMetadata {
  controllerName: string
  handlerName: string
}

type AdminRbacHandler = (...args: unknown[]) => unknown

function isAdminRbacHandler(value: unknown): value is AdminRbacHandler {
  return typeof value === 'function'
}

@Injectable()
export class AdminRbacMetadataService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

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

  getHandlerPermission(contextClass: Type<unknown>, handler: unknown) {
    if (!isAdminRbacHandler(handler)) {
      return undefined
    }
    return this.reflector.getAllAndOverride<AdminPermissionMetadata, string>(
      ADMIN_PERMISSION_KEY,
      [handler, contextClass],
    )
  }

  isPublic(contextClass: Type<unknown>, handler: unknown) {
    if (!isAdminRbacHandler(handler)) {
      return undefined
    }
    return this.reflector.getAllAndOverride<boolean, string>(IS_PUBLIC_KEY, [
      handler,
      contextClass,
    ])
  }

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
