import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

jest.mock('@db/core', () => ({
  buildILikeCondition: jest.fn((_column: unknown, value?: string) =>
    value ? { type: 'ilike', value } : undefined,
  ),
  DrizzleService: class {},
}))

describe('agreement service', () => {
  it('rejects updating a published agreement in place', async () => {
    const { BadRequestException } = await import('@nestjs/common')
    const { AgreementService } = await import('../agreement.service')

    const where = jest.fn().mockResolvedValue({ rowCount: 1 })
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))
    const withErrorHandling = jest.fn(async (callback) => callback())

    const service = new AgreementService({
      db: {
        update,
        query: {
          appAgreement: {
            findFirst: jest.fn().mockResolvedValue({
              id: 1,
              isPublished: true,
            }),
          },
        },
      },
      schema: {
        appAgreement: { id: 'id' },
      },
      withErrorHandling,
      assertAffectedRows: jest.fn(),
    } as any)

    await expect(
      service.update({
        id: 1,
        title: '隐私政策',
      } as any),
    ).rejects.toThrow(
      new BadRequestException('已发布协议不允许直接修改，请新建版本后发布'),
    )

    expect(withErrorHandling).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('allows updating an unpublished agreement draft', async () => {
    const { AgreementService } = await import('../agreement.service')

    const result = { rowCount: 1 }
    const where = jest.fn().mockResolvedValue(result)
    const set = jest.fn(() => ({ where }))
    const update = jest.fn(() => ({ set }))
    const withErrorHandling = jest.fn(async (callback) => callback())

    const service = new AgreementService({
      db: {
        update,
        query: {
          appAgreement: {
            findFirst: jest.fn().mockResolvedValue({
              id: 2,
              isPublished: false,
            }),
          },
        },
      },
      schema: {
        appAgreement: { id: 'id' },
      },
      withErrorHandling,
    } as any)

    await expect(
      service.update({
        id: 2,
        title: '用户协议',
      } as any),
    ).resolves.toBe(true)

    expect(withErrorHandling).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(1)
    expect(withErrorHandling).toHaveBeenCalledWith(
      expect.any(Function),
      {
        duplicate: '协议标题和版本已存在',
        notFound: '协议不存在',
      },
    )
  })

  it('rejects unpublishing an unpublished agreement draft', async () => {
    const { BadRequestException } = await import('@nestjs/common')
    const { AgreementService } = await import('../agreement.service')

    const update = jest.fn()
    const withErrorHandling = jest.fn(async (callback) => callback())

    const service = new AgreementService({
      db: {
        update,
        query: {
          appAgreement: {
            findFirst: jest.fn().mockResolvedValue({
              id: 3,
              isPublished: false,
            }),
          },
        },
      },
      schema: {
        appAgreement: { id: 'id' },
      },
      withErrorHandling,
      assertAffectedRows: jest.fn(),
    } as any)

    await expect(
      service.updatePublishStatus({
        id: 3,
        isPublished: false,
      }),
    ).rejects.toThrow(
      new BadRequestException('未发布协议不允许下线'),
    )

    expect(withErrorHandling).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('returns only the latest published agreement for each title', async () => {
    const { AgreementService } = await import('../agreement.service')

    const findMany = jest.fn().mockResolvedValue([
      {
        id: 2,
        title: '用户协议',
        version: '2024.02',
        isPublished: true,
        publishedAt: new Date('2024-02-01T00:00:00.000Z'),
      },
      {
        id: 4,
        title: '隐私政策',
        version: '2024.03',
        isPublished: true,
        publishedAt: new Date('2024-03-01T00:00:00.000Z'),
      },
      {
        id: 1,
        title: '用户协议',
        version: '2024.01',
        isPublished: true,
        publishedAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        id: 3,
        title: '隐私政策',
        version: '2024.01',
        isPublished: true,
        publishedAt: new Date('2024-01-15T00:00:00.000Z'),
      },
    ])

    const service = new AgreementService({
      db: {
        query: {
          appAgreement: {
            findMany,
          },
        },
      },
      schema: {
        appAgreement: { id: 'id' },
      },
    } as any)

    await expect(service.getAllLatest({ showInAuth: true } as any)).resolves.toEqual([
      expect.objectContaining({
        id: 4,
        title: '隐私政策',
        version: '2024.03',
      }),
      expect.objectContaining({
        id: 2,
        title: '用户协议',
        version: '2024.02',
      }),
    ])

    expect(findMany).toHaveBeenCalledTimes(1)
  })

  it('exposes a single admin route for publish lifecycle changes', () => {
    const controllerSource = readFileSync(
      resolve(
        process.cwd(),
        'apps/admin-api/src/modules/app-content/agreement/agreement.controller.ts',
      ),
      'utf8',
    )

    expect(controllerSource).not.toContain("@Post('delete')")
  })
})
