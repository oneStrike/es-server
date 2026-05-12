/// <reference types="jest" />

import type { SystemConfigService } from '@libs/system-config/system-config.service'
import { SystemConfigController } from './system-config.controller'

describe('SystemConfigController', () => {
  it('returns security config from the masked system config snapshot', async () => {
    const systemConfigService = {
      findMaskedConfig: jest.fn(() =>
        Promise.resolve({
          id: 1,
          securityConfig: {
            remoteImageImport: {
              enableAddressGuard: true,
            },
          },
        }),
      ),
    }
    const controller = new SystemConfigController(
      systemConfigService as unknown as SystemConfigService,
    )

    await expect(controller.getConfig()).resolves.toEqual(
      expect.objectContaining({
        securityConfig: {
          remoteImageImport: {
            enableAddressGuard: true,
          },
        },
      }),
    )
    expect(systemConfigService.findMaskedConfig).toHaveBeenCalled()
  })
})
