/// <reference types="jest" />

import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { WorkAuthorService } from './author.service'
import { AuthorTypeEnum } from './author.constant'

function createSubject() {
  const limit = jest.fn(async (): Promise<any[]> => [])
  const where = jest.fn(() => ({ limit }))
  const innerJoin = jest.fn(() => ({ where }))
  const from = jest.fn(() => ({ innerJoin }))
  const select = jest.fn(() => ({ from }))
  const updateWhere = jest.fn(() => ({ rowCount: 1 }))
  const set = jest.fn(() => ({ where: updateWhere }))
  const update = jest.fn(() => ({ set }))
  const db = {
    select,
    update,
  }
  const drizzle = {
    db,
    schema: {
      work: {
        id: 'work.id',
        type: 'work.type',
        deletedAt: 'work.deletedAt',
      },
      workAuthor: {
        id: 'workAuthor.id',
        deletedAt: 'workAuthor.deletedAt',
      },
      workAuthorRelation: {
        authorId: 'workAuthorRelation.authorId',
        workId: 'workAuthorRelation.workId',
      },
    },
    withErrorHandling: jest.fn(async (callback: () => unknown) => callback()),
  }
  const service = new WorkAuthorService({
    ...drizzle,
  } as any)

  return { db, drizzle, limit, service, update }
}

function expectOperationNotAllowed(callback: () => unknown) {
  try {
    callback()
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessException)
    expect(error).toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
    })
    return
  }

  throw new Error('Expected operation to be rejected')
}

describe('WorkAuthorService author type filter', () => {
  it('rejects malformed author type JSON', () => {
    const { service } = createSubject()

    expectOperationNotAllowed(() =>
      (service as any).parseAuthorTypeFilter('[1,'),
    )
  })

  it('rejects author type values outside the closed enum', () => {
    const { service } = createSubject()

    expectOperationNotAllowed(() =>
      (service as any).parseAuthorTypeFilter('[1,3]'),
    )
  })

  it('normalizes duplicate author type values', () => {
    const { service } = createSubject()

    expect((service as any).parseAuthorTypeFilter('[1,1,2]')).toEqual([
      AuthorTypeEnum.MANGA,
      AuthorTypeEnum.NOVEL,
    ])
  })
})

describe('WorkAuthorService author type update boundary', () => {
  it('rejects removing manga role while the author is linked to a live comic work', async () => {
    const { drizzle, limit, service, update } = createSubject()
    limit.mockResolvedValueOnce([{ id: 10, type: 1 }])

    await expect(
      service.updateAuthor({ id: 1, type: [AuthorTypeEnum.NOVEL] } as any),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
    })

    expect(drizzle.withErrorHandling).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('allows updating author type when required linked-work roles remain', async () => {
    const { drizzle, limit, service, update } = createSubject()
    limit.mockResolvedValueOnce([])

    await expect(
      service.updateAuthor({
        id: 1,
        type: [AuthorTypeEnum.MANGA, AuthorTypeEnum.NOVEL],
      } as any),
    ).resolves.toBe(true)

    expect(drizzle.withErrorHandling).toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })
})
