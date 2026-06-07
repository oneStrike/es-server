/// <reference types="jest" />

import { AuditActionTypeEnum } from '@libs/platform/modules/audit/audit-action.constant'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { AdRewardController } from './ad-reward.controller'
import 'reflect-metadata'

describe('admin AdRewardController route smoke', () => {
  function routeHandler(name: string) {
    return Reflect.get(AdRewardController.prototype, name)
  }

  function createController() {
    const adRewardService = {
      getAdRewardReconcilePage: jest.fn(async (query) => Promise.resolve(query)),
      getAdRewardRecordDetail: jest.fn(async (id) => Promise.resolve({ id })),
      getAdRewardRecordPage: jest.fn(async (query) => Promise.resolve(query)),
      revokeAdRewardRecord: jest.fn(async (body) => Promise.resolve(body)),
    }
    return {
      adRewardService,
      controller: new AdRewardController(adRewardService as any),
    }
  }

  it('registers admin reward record routes and delegates operations', async () => {
    const { adRewardService, controller } = createController()

    expect(Reflect.getMetadata(PATH_METADATA, AdRewardController)).toBe(
      'admin/ad-reward',
    )
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        routeHandler('getAdRewardRecordPage'),
      ),
    ).toBe('record/page')
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        routeHandler('getAdRewardRecordPage'),
      ),
    ).toBe(0)
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        routeHandler('getAdRewardRecordDetail'),
      ),
    ).toBe('record/detail')
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        routeHandler('getAdRewardReconcilePage'),
      ),
    ).toBe('record/reconcile/page')
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        routeHandler('revokeAdRewardRecord'),
      ),
    ).toBe('record/revoke')
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        routeHandler('revokeAdRewardRecord'),
      ),
    ).toBe(1)
    expect(
      Reflect.getMetadata(
        'audit',
        routeHandler('revokeAdRewardRecord'),
      ),
    ).toMatchObject({
      actionType: AuditActionTypeEnum.UPDATE,
    })

    await expect(
      controller.getAdRewardRecordPage({ pageIndex: 1 } as any),
    ).resolves.toEqual({ pageIndex: 1 })
    await expect(controller.getAdRewardRecordDetail(7)).resolves.toEqual({
      id: 7,
    })
    await expect(
      controller.getAdRewardReconcilePage({ status: 1 } as any),
    ).resolves.toEqual({ status: 1 })
    await expect(controller.revokeAdRewardRecord({ id: 7 })).resolves.toEqual({
      id: 7,
    })

    expect(adRewardService.getAdRewardRecordPage).toHaveBeenCalledWith({
      pageIndex: 1,
    })
    expect(adRewardService.getAdRewardRecordDetail).toHaveBeenCalledWith(7)
    expect(adRewardService.getAdRewardReconcilePage).toHaveBeenCalledWith({
      status: 1,
    })
    expect(adRewardService.revokeAdRewardRecord).toHaveBeenCalledWith({ id: 7 })
  })
})
