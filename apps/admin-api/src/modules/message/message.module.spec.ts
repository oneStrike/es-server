import type { Type } from '@nestjs/common'
import { MessageGateway } from '@libs/message/notification/notification.gateway'
import { MODULE_METADATA } from '@nestjs/common/constants'
import { MessageModule } from './message.module'

jest.mock('uuid', () => ({
  v4: () => '00000000-0000-4000-8000-000000000000',
}))

type ModuleImport = Type<unknown> | { module: Type<unknown> }

function getModuleType(moduleImport: ModuleImport): Type<unknown> {
  if (typeof moduleImport === 'function') {
    return moduleImport
  }

  return moduleImport.module
}

function collectProviders(
  moduleType: Type<unknown>,
  seen = new Set<Type<unknown>>(),
): unknown[] {
  if (seen.has(moduleType)) {
    return []
  }
  seen.add(moduleType)

  const providers =
    Reflect.getMetadata(MODULE_METADATA.PROVIDERS, moduleType) ?? []
  const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleType) ??
    []) as ModuleImport[]

  return [
    ...providers,
    ...imports.flatMap((moduleImport) =>
      collectProviders(getModuleType(moduleImport), seen),
    ),
  ]
}

describe('Admin MessageModule websocket boundary', () => {
  it('does not pull websocket gateway providers into admin-api', () => {
    expect(collectProviders(MessageModule)).not.toContain(MessageGateway)
  })
})
