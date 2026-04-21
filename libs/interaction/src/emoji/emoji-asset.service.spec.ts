/// <reference types="jest" />
import 'reflect-metadata'
import type { DrizzleService } from '@db/core'
import { emojiAsset, emojiPack } from '@db/schema'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { ValidationPipe } from '@nestjs/common'
import {
  CreateEmojiAssetDto,
  CreateEmojiPackDto,
} from './dto/emoji.dto'
import {
  EmojiAssetKindEnum,
  EmojiSceneEnum,
} from './emoji.constant'
import { EmojiAssetService } from './emoji-asset.service'

async function transformDto<T extends object>(
  metatype: new () => T,
  value: Record<string, unknown>,
): Promise<T> {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  })

  return pipe.transform(value, {
    metatype,
    type: 'body',
  } as never)
}

function createAssetHarness(options?: { maxOrder?: number; packExists?: boolean }) {
  const insertPayloads: Array<Record<string, unknown>> = []

  const db = {
    insert: jest.fn(() => ({
      values: jest.fn((payload: Record<string, unknown>) => {
        insertPayloads.push(payload)
        return Promise.resolve([])
      }),
    })),
    query: {
      emojiPack: {
        findFirst: jest
          .fn()
          .mockResolvedValue(options?.packExists === false ? null : { id: 1 }),
      },
      emojiAsset: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    },
  }

  const drizzle = {
    db,
    schema: {
      emojiPack,
      emojiAsset,
    },
    ext: {
      maxOrder: jest.fn().mockResolvedValue(options?.maxOrder ?? 0),
    },
    withErrorHandling: async <T>(callback: () => Promise<T> | T) => callback(),
  } as unknown as DrizzleService

  return {
    drizzle,
    insertPayloads,
  }
}

describe('EmojiAssetService create contract', () => {
  it('appends pack sort order when omitted and preserves explicit disabled state', async () => {
    const harness = createAssetHarness({ maxOrder: 7 })
    const service = new EmojiAssetService(harness.drizzle)
    const dto = await transformDto(CreateEmojiPackDto, {
      code: 'winter',
      name: '冬季表情包',
      sceneType: [EmojiSceneEnum.CHAT],
      isEnabled: false,
    })

    await service.createPack(dto, 9)

    expect(harness.insertPayloads[0]).toMatchObject({
      code: 'winter',
      name: '冬季表情包',
      sceneType: [EmojiSceneEnum.CHAT],
      sortOrder: 8,
      isEnabled: false,
      visibleInPicker: true,
      createdById: 9,
      updatedById: 9,
    })
  })

  it('appends asset sort order when omitted and preserves explicit disabled state', async () => {
    const harness = createAssetHarness({ maxOrder: 4 })
    const service = new EmojiAssetService(harness.drizzle)
    const dto = await transformDto(CreateEmojiAssetDto, {
      packId: 1,
      kind: EmojiAssetKindEnum.CUSTOM,
      shortcode: 'winter_cat',
      imageUrl: 'https://cdn.example.com/emoji/winter-cat.png',
      isEnabled: false,
    })

    await service.createAsset(dto, 7)

    expect(harness.insertPayloads[0]).toMatchObject({
      packId: 1,
      kind: EmojiAssetKindEnum.CUSTOM,
      shortcode: 'winter_cat',
      imageUrl: 'https://cdn.example.com/emoji/winter-cat.png',
      sortOrder: 5,
      isEnabled: false,
      isAnimated: false,
      createdById: 7,
      updatedById: 7,
    })
  })

  it('raises BusinessException for invalid custom asset payloads', async () => {
    const harness = createAssetHarness()
    const service = new EmojiAssetService(harness.drizzle)
    const dto = await transformDto(CreateEmojiAssetDto, {
      packId: 1,
      kind: EmojiAssetKindEnum.CUSTOM,
      shortcode: 'broken_custom',
    })

    await expect(service.createAsset(dto, 3)).rejects.toMatchObject({
      code: BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message: 'custom 表情必须填写 imageUrl',
    } satisfies Partial<BusinessException>)
  })
})
