/// <reference types="jest" />

import type { ArgumentMetadata } from '@nestjs/common'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { PageDto } from './page.dto'

describe('PageDto validation boundary', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  })
  const metadata: ArgumentMetadata = {
    type: 'query',
    metatype: PageDto,
    data: '',
  }

  it('accepts complete app pagination query fields', async () => {
    const result = await pipe.transform(
      {
        pageIndex: '2',
        pageSize: '30',
        orderBy: '{"createdAt":"desc"}',
        startDate: '2025-05-29',
        endDate: '2025-05-30',
        ignored: 'value',
      },
      metadata,
    )

    expect(result).toMatchObject({
      pageIndex: 2,
      pageSize: 30,
      orderBy: '{"createdAt":"desc"}',
      startDate: '2025-05-29',
      endDate: '2025-05-30',
    })
    expect(result).not.toHaveProperty('ignored')
  })

  it('keeps omitted page fields optional at DTO boundary', async () => {
    const result = await pipe.transform({}, metadata)

    expect(result).toMatchObject({
      pageIndex: undefined,
      pageSize: undefined,
    })
  })

  it.each([
    ['pageIndex', '0'],
    ['pageSize', '0'],
    ['pageSize', '501'],
  ])('rejects invalid %s value %s', async (field, value) => {
    await expect(
      pipe.transform(
        {
          [field]: value,
        },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it.each([
    ['orderBy', "{createdAt:'desc'}"],
    ['startDate', '2025-99-99'],
    ['endDate', 'not-a-date'],
  ])('rejects invalid %s value', async (field, value) => {
    await expect(
      pipe.transform(
        {
          [field]: value,
        },
        metadata,
      ),
    ).rejects.toThrow(BadRequestException)
  })
})
