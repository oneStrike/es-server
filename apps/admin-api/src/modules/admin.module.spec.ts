import type { Type } from '@nestjs/common'
import { MessageGateway } from '@libs/message/notification/notification.gateway'
import { MODULE_METADATA } from '@nestjs/common/constants'
import { AdminModule } from './admin.module'

jest.mock('uuid', () => ({
  v4: () => '00000000-0000-4000-8000-000000000000',
}))

jest.mock('ip2region.js', () => ({
  IPv4: Symbol('IPv4'),
  loadContentFromFile: jest.fn(),
  newWithBuffer: jest.fn(() => ({
    close: jest.fn(),
    search: jest.fn(),
  })),
  verifyFromFile: jest.fn(),
}))

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
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

describe('AdminModule websocket boundary', () => {
  it('does not pull message websocket gateway into admin-api', () => {
    expect(collectProviders(AdminModule)).not.toContain(MessageGateway)
  })
})
