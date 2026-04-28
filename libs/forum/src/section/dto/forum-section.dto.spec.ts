import 'reflect-metadata'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import {
  QueryForumSectionDto,
  QueryPublicForumSectionDto,
} from './forum-section.dto'

async function transformQueryDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
): Promise<T> {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  })

  return pipe.transform(value, {
    metatype,
    type: 'query',
  } as never)
}

describe('ForumSection query filter contract', () => {
  it('transforms isUngrouped query parameters into booleans', async () => {
    await expect(
      transformQueryDto(QueryPublicForumSectionDto, {
        isUngrouped: 'true',
      }),
    ).resolves.toMatchObject({
      isUngrouped: true,
    })
  })

  it('rejects the legacy groupId=null query pattern', async () => {
    await expect(
      transformQueryDto(QueryForumSectionDto, {
        groupId: 'null',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
