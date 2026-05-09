/// <reference types="jest" />

import * as schema from '@db/schema'
import { ContentEntitlementService } from './content-entitlement.service'
import { ContentEntitlementTargetTypeEnum } from './content-entitlement.constant'

function createSelectBuilder<TResult>(result: TResult[]) {
  const builder = {
    from: jest.fn(() => builder),
    where: jest.fn(() => builder),
    limit: jest.fn(() => Promise.resolve(result)),
  }
  return builder
}

describe('ContentEntitlementService', () => {
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
    const returning = jest.fn(() =>
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
})
