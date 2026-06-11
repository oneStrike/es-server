/// <reference types="jest" />

import type { ArgumentMetadata } from '@nestjs/common'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { CursorPageDto } from './page.dto'

describe('CursorPageDto validation boundary', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  })
  const metadata: ArgumentMetadata = {
    type: 'query',
    metatype: CursorPageDto,
    data: '',
  }

  it.each(['pageIndex', 'orderBy', 'startDate', 'endDate'])(
    'rejects legacy cursor field %s before whitelist can strip it',
    async (field) => {
      await expect(
        pipe.transform(
          {
            pageSize: '10',
            cursor: 'cursor-1',
            [field]: '',
          },
          metadata,
        ),
      ).rejects.toThrow(BadRequestException)
    },
  )

  it('keeps cursor fields and strips unrelated unknown fields', async () => {
    const result = await pipe.transform(
      {
        pageSize: '10',
        cursor: 'cursor-1',
        ignored: 'value',
      },
      metadata,
    )

    expect(result).toMatchObject({
      pageSize: 10,
      cursor: 'cursor-1',
    })
    expect(result).not.toHaveProperty('ignored')
  })
})
