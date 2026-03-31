import { workTag } from '@db/schema'
import { maxOrder } from '../maxOrder'

describe('maxOrder', () => {
  it('reads the target table from the column reference and returns the max value', async () => {
    const limit = jest.fn().mockResolvedValue([{ value: 7 }])
    const orderBy = jest.fn(() => ({ limit }))
    const where = jest.fn(() => ({ orderBy }))
    const from = jest.fn(() => ({ where }))
    const select = jest.fn(() => ({ from }))
    const db = { select } as any
    const whereCondition = { __where: true } as any

    await expect(
      maxOrder(db, {
        column: workTag.sortOrder,
        where: whereCondition,
      }),
    ).resolves.toBe(7)

    expect(from).toHaveBeenCalledWith(workTag)
    expect(where).toHaveBeenCalledWith(whereCondition)
  })

  it('returns 0 when the target range has no records', async () => {
    const limit = jest.fn().mockResolvedValue([])
    const orderBy = jest.fn(() => ({ limit }))
    const where = jest.fn(() => ({ orderBy }))
    const from = jest.fn(() => ({ where }))
    const select = jest.fn(() => ({ from }))
    const db = { select } as any

    await expect(
      maxOrder(db, {
        column: workTag.sortOrder,
      }),
    ).resolves.toBe(0)
  })
})
