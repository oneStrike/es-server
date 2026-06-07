/// <reference types="jest" />

import * as schema from '@db/schema'
import {
  ContentEntitlementGrantSourceEnum,
  ContentEntitlementStatusEnum,
  ContentEntitlementTargetTypeEnum,
} from './content-entitlement.constant'
import { ContentEntitlementService } from './content-entitlement.service'

function createSelectBuilder<TResult>(result: TResult[]) {
  const builder = {
    from: jest.fn(() => builder),
    where: jest.fn(() => builder),
    limit: jest.fn(async () => Promise.resolve(result)),
  }
  return builder
}

describe('contentEntitlementService', () => {
  it('checks purchase entitlement from user_content_entitlement only', async () => {
    const drizzle = {
      schema,
      db: {
        select: jest.fn(() => createSelectBuilder([{ id: 1 }])),
      },
    }
    const service = new (ContentEntitlementService as any)(
      drizzle,
    ) as ContentEntitlementService

    await expect(
      service.hasPurchaseEntitlement({
        userId: 1,
        targetType: ContentEntitlementTargetTypeEnum.COMIC_CHAPTER,
        targetId: 2,
      }),
    ).resolves.toBe(true)

    expect(drizzle.db.select).toHaveBeenCalledWith({
      id: schema.userContentEntitlement.id,
    })
  })

  it('writes purchase entitlement as a permanent active grant', async () => {
    const returning = jest.fn(async () =>
      Promise.resolve([
        {
          id: 1,
        },
      ]),
    )
    const values = jest.fn(() => ({ returning }))
    const tx = {
      insert: jest.fn(() => ({ values })),
    }
    const drizzle = {
      schema,
      db: {},
    }
    const service = new (ContentEntitlementService as any)(
      drizzle,
    ) as ContentEntitlementService

    await service.grantPurchaseEntitlement(tx as any, {
      userId: 1,
      targetType: ContentEntitlementTargetTypeEnum.COMIC_CHAPTER,
      targetId: 2,
      sourceId: 3,
    })

    expect(tx.insert).toHaveBeenCalledWith(schema.userContentEntitlement)
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        targetType: ContentEntitlementTargetTypeEnum.COMIC_CHAPTER,
        targetId: 2,
        grantSource: 1,
        sourceId: 3,
        status: 1,
      }),
    )
  })

  it('revokes active entitlements by exact grant source and source id', async () => {
    const returning = jest.fn(async () => Promise.resolve([{ id: 1 }, { id: 2 }]))
    const where = jest.fn(() => ({ returning }))
    const set = jest.fn(() => ({ where }))
    const tx = {
      update: jest.fn(() => ({ set })),
    }
    const drizzle = {
      schema,
      db: {},
    }
    const service = new (ContentEntitlementService as any)(
      drizzle,
    ) as ContentEntitlementService

    await expect(
      service.revokeEntitlementBySource(tx as any, {
        grantSource: ContentEntitlementGrantSourceEnum.AD,
        sourceId: 7,
      }),
    ).resolves.toBe(2)

    expect(tx.update).toHaveBeenCalledWith(schema.userContentEntitlement)
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        revokedAt: expect.any(Date),
        status: ContentEntitlementStatusEnum.REVOKED,
      }),
    )
    expect(where).toHaveBeenCalledTimes(1)
  })
})
