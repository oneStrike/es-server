/// <reference types="jest" />

import * as schema from '@db/schema'
import { MembershipEntitlementService } from './membership-entitlement.service'

function createSelectBuilder<TResult>(result: TResult[]) {
  const builder = {
    from: jest.fn(() => builder),
    where: jest.fn(() => builder),
    limit: jest.fn(() => Promise.resolve(result)),
  }
  return builder
}

describe('MembershipEntitlementService', () => {
  it('returns true when an active subscription exists', async () => {
    const drizzle = {
      schema,
      db: {
        select: jest.fn(() => createSelectBuilder([{ id: 1 }])),
      },
    }
    const service = new (MembershipEntitlementService as any)(
      drizzle,
    ) as MembershipEntitlementService

    await expect(service.hasActiveSubscription(1)).resolves.toBe(true)
  })

  it('returns false when no active subscription exists', async () => {
    const drizzle = {
      schema,
      db: {
        select: jest.fn(() => createSelectBuilder([])),
      },
    }
    const service = new (MembershipEntitlementService as any)(
      drizzle,
    ) as MembershipEntitlementService

    await expect(service.hasActiveSubscription(1)).resolves.toBe(false)
  })
})
