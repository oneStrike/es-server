import { ValidationPipe } from '@nestjs/common'
import {
  QueryPurchasedWorkChapterDto,
  QueryPurchasedWorkDto,
} from './purchase.dto'
import 'reflect-metadata'

describe('purchase dto read contract', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  })

  it('已购作品查询参数会过滤掉无效的 targetType 字段', async () => {
    const transformed = await pipe.transform(
      {
        pageIndex: 1,
        pageSize: 10,
        status: 1,
        workType: 2,
        targetType: 1,
      },
      {
        type: 'query',
        metatype: QueryPurchasedWorkDto,
      },
    )

    expect(transformed).toMatchObject({
      pageIndex: 1,
      pageSize: 10,
      status: 1,
      workType: 2,
    })
    expect(transformed).not.toHaveProperty('targetType')
  })

  it('已购章节查询参数会过滤掉无效的 targetType 字段', async () => {
    const transformed = await pipe.transform(
      {
        pageIndex: 1,
        pageSize: 10,
        status: 1,
        workType: 1,
        workId: 7,
        targetType: 2,
      },
      {
        type: 'query',
        metatype: QueryPurchasedWorkChapterDto,
      },
    )

    expect(transformed).toMatchObject({
      pageIndex: 1,
      pageSize: 10,
      status: 1,
      workType: 1,
      workId: 7,
    })
    expect(transformed).not.toHaveProperty('targetType')
  })
})
