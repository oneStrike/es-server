import { DrizzleService } from '@db/core'
import { HttpException, NotFoundException } from '@nestjs/common'

describe('drizzle service', () => {
  let service: DrizzleService

  beforeEach(() => {
    service = new DrizzleService(
      {} as any,
      {
        end: jest.fn(),
      } as any,
      {
        get: jest.fn(),
      } as any,
    )
  })

  it('传入 notFound 时 update 未命中会抛出 NotFoundException', async () => {
    await expect(service.withErrorHandling(
      async () => ({ rowCount: 0 }),
      { notFound: '用户不存在' } as any,
    )).rejects.toThrow(new NotFoundException('用户不存在'))
  })

  it('传入 notFound 时 returning 空数组也会抛出 NotFoundException', async () => {
    await expect(service.withErrorHandling(
      async () => [],
      { notFound: '记录不存在' } as any,
    )).rejects.toThrow(new NotFoundException('记录不存在'))
  })

  it('未传 notFound 时保留原有 withErrorHandling 语义', async () => {
    await expect(service.withErrorHandling(
      async () => ({ rowCount: 0 }),
    )).resolves.toEqual({ rowCount: 0 })
  })

  it('同时传 duplicate 和 notFound 时仍优先保留数据库唯一约束语义', async () => {
    try {
      await service.withErrorHandling(
        async () => {
          throw Object.assign(new Error('duplicate key value violates unique constraint'), {
            code: '23505',
          })
        },
        {
          duplicate: '数据已存在',
          notFound: '记录不存在',
        },
      )
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException)
      expect((error as HttpException).message).toBe('数据已存在')
      expect((error as HttpException).getStatus()).toBe(409)
      return
    }

    throw new Error('expected unique violation to be rethrown')
  })
})
