/// <reference types="jest" />

import { DrizzleService } from '@db/core'
import { WorkTypeEnum } from '@libs/platform/constant'
import { WorkChapterService } from './work-chapter.service'

function createUpdateDb(returningRows: Array<{ id: number }>) {
  const returning = jest.fn(async () => returningRows)
  const where = jest.fn(() => ({ returning }))
  const set = jest.fn(() => ({ where }))
  const update = jest.fn(() => ({ set }))
  const dbUpdate = jest.fn(() => {
    throw new Error('batch status updates must run inside a transaction')
  })
  const tx = { update }
  const withTransaction = jest.fn(async (callback) => callback(tx))

  return {
    db: { update: dbUpdate },
    dbUpdate,
    returning,
    schema: {
      workChapter: {
        deletedAt: 'work_chapter.deleted_at',
        id: 'work_chapter.id',
        isPublished: 'work_chapter.is_published',
        workType: 'work_chapter.work_type',
      },
    },
    set,
    tx,
    update,
    where,
    withTransaction,
  }
}

function createService(drizzle: unknown) {
  return new WorkChapterService(
    drizzle as DrizzleService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  )
}

function flattenSqlChunks(chunk: unknown, output: unknown[] = []) {
  if (Array.isArray(chunk)) {
    output.push(chunk)
    return output
  }

  if (!chunk || typeof chunk !== 'object') {
    output.push(chunk)
    return output
  }

  if (
    'queryChunks' in chunk &&
    Array.isArray((chunk as { queryChunks: unknown[] }).queryChunks)
  ) {
    for (const item of (chunk as { queryChunks: unknown[] }).queryChunks) {
      flattenSqlChunks(item, output)
    }
    return output
  }

  if ('value' in chunk && Array.isArray((chunk as { value: unknown[] }).value)) {
    output.push((chunk as { value: unknown[] }).value.join(''))
    return output
  }

  output.push(chunk)
  return output
}

function getWhereSqlChunks(where: jest.Mock) {
  const predicate = where.mock.calls[0]?.[0]
  return flattenSqlChunks(predicate)
}

describe('WorkChapterService batch publish status', () => {
  it('updates comic chapter publish status with id, work type, and deletion filters', async () => {
    const drizzle = createUpdateDb([{ id: 1 }, { id: 2 }])
    const service = createService(drizzle)

    await expect(
      service.batchUpdateChapterPublishStatus(
        { ids: [1, 2], isPublished: true },
        WorkTypeEnum.COMIC,
      ),
    ).resolves.toBe(true)

    expect(drizzle.update).toHaveBeenCalledWith(drizzle.schema.workChapter)
    expect(drizzle.dbUpdate).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(drizzle.set).toHaveBeenCalledWith({ isPublished: true })
    expect(drizzle.where).toHaveBeenCalledTimes(1)
    const whereChunks = getWhereSqlChunks(drizzle.where)
    const whereSql = whereChunks.join('')

    expect(whereChunks).toEqual(
      expect.arrayContaining([
        'work_chapter.id',
        'work_chapter.work_type',
        'work_chapter.deleted_at',
        WorkTypeEnum.COMIC,
      ]),
    )
    expect(whereChunks).toContainEqual([1, 2])
    expect(whereSql).toContain(' in ')
    expect(whereSql).toContain(' = ')
    expect(whereSql).toContain(' is null')
  })

  it('returns true without writing when ids are empty', async () => {
    const drizzle = createUpdateDb([])
    const service = createService(drizzle)

    await expect(
      service.batchUpdateChapterPublishStatus(
        { ids: [], isPublished: true },
        WorkTypeEnum.COMIC,
      ),
    ).resolves.toBe(true)

    expect(drizzle.update).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).not.toHaveBeenCalled()
  })

  it('deduplicates ids before comparing updated row count', async () => {
    const drizzle = createUpdateDb([{ id: 1 }, { id: 2 }])
    const service = createService(drizzle)

    await expect(
      service.batchUpdateChapterPublishStatus(
        { ids: [1, 1, 2], isPublished: false },
        WorkTypeEnum.COMIC,
      ),
    ).resolves.toBe(true)

    expect(drizzle.set).toHaveBeenCalledWith({ isPublished: false })
    expect(drizzle.dbUpdate).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
    expect(drizzle.where).toHaveBeenCalledTimes(1)
    expect(getWhereSqlChunks(drizzle.where)).toContainEqual([1, 2])
  })

  it('fails inside the transaction when some ids are missing, deleted, or outside the requested work type', async () => {
    const drizzle = createUpdateDb([{ id: 1 }])
    const service = createService(drizzle)

    await expect(
      service.batchUpdateChapterPublishStatus(
        { ids: [1, 2], isPublished: true },
        WorkTypeEnum.COMIC,
      ),
    ).rejects.toThrow('章节不存在')

    expect(drizzle.dbUpdate).not.toHaveBeenCalled()
    expect(drizzle.withTransaction).toHaveBeenCalledTimes(1)
  })
})
