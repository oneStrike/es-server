import 'reflect-metadata'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import {
  CreateForumSectionDto,
  QueryForumSectionDto,
  QueryPublicForumSectionDetailDto,
  QueryPublicForumSectionDto,
  UpdateForumSectionDto,
} from './forum-section.dto'

async function transformDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
  type: 'body' | 'query',
): Promise<T> {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  })

  return pipe.transform(value, {
    metatype,
    type,
  } as never)
}

async function transformQueryDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
) {
  return transformDto(metatype, value, 'query')
}

async function transformBodyDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
) {
  return transformDto(metatype, value, 'body')
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

  it('drops legacy userId injection from public detail queries', async () => {
    const dto = await transformQueryDto(QueryPublicForumSectionDetailDto, {
      id: '7',
      userId: '99',
    })

    expect(dto).toMatchObject({ id: 7 })
    expect('userId' in dto).toBe(false)
  })
})

describe('ForumSection writable dto boundary', () => {
  it('does not accept followersCount in create payloads', async () => {
    const dto = await transformBodyDto(CreateForumSectionDto, {
      name: '技术交流',
      icon: 'https://example.com/icon.png',
      cover: 'https://example.com/cover.png',
      sortOrder: 0,
      isEnabled: true,
      topicReviewPolicy: 1,
      followersCount: 42,
    })

    expect(dto).toMatchObject({
      name: '技术交流',
      topicReviewPolicy: 1,
    })
    expect('followersCount' in dto).toBe(false)
  })

  it('does not accept followersCount in update payloads', async () => {
    const dto = await transformBodyDto(UpdateForumSectionDto, {
      id: 5,
      followersCount: 42,
    })

    expect(dto).toMatchObject({ id: 5 })
    expect('followersCount' in dto).toBe(false)
  })
})
