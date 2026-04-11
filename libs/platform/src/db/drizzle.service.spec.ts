import { DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant/error-code.constant'
import { BusinessException } from '@libs/platform/exceptions'
import { BadRequestException } from '@nestjs/common'

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

  it('传入 notFound 时 update 未命中会抛出 BusinessException', async () => {
    await expect(
      service.withErrorHandling(async () => ({ rowCount: 0 }), {
        notFound: '用户不存在',
      } as any),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '用户不存在',
    })
  })

  it('传入 notFound 时 returning 空数组也会抛出 BusinessException', async () => {
    await expect(
      service.withErrorHandling(async () => [], {
        notFound: '记录不存在',
      } as any),
    ).rejects.toMatchObject({
      code: BusinessErrorCode.RESOURCE_NOT_FOUND,
      message: '记录不存在',
    })
  })

  it('唯一约束冲突映射为资源已存在业务异常并保留 cause', async () => {
    const error = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      {
        code: '23505',
        constraint: 'app_user_phone_key',
      },
    )

    try {
      await service.withErrorHandling(
        async () => {
          throw error
        },
        {
          duplicate: '手机号已存在',
        },
      )
    } catch (caught) {
      expect(caught).toBeInstanceOf(BusinessException)
      expect(caught).toMatchObject({
        code: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        message: '手机号已存在',
        cause: error,
      })
      return
    }

    throw new Error('expected unique violation to be rethrown')
  })

  it('非空约束冲突仍保留 400 异常语义', async () => {
    const error = Object.assign(new Error('null value violates not-null'), {
      code: '23502',
    })

    await expect(
      service.withErrorHandling(async () => {
        throw error
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
