/// <reference types="jest" />
import type { DrizzleService } from '@db/core'
import { emojiAsset, emojiPack, emojiRecentUsage } from '@db/schema'
import { PgDialect } from 'drizzle-orm/pg-core/dialect'
import { EmojiCatalogService } from './emoji-catalog.service'
import { EmojiSceneEnum } from './emoji.constant'

const dialect = new PgDialect()

function compileCondition(condition: unknown) {
  return dialect.sqlToQuery(condition as never).sql
}

describe('EmojiCatalogService picker visibility', () => {
  it('adds visibleInPicker filtering to catalog queries', async () => {
    let capturedCondition: unknown

    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn((condition: unknown) => {
            capturedCondition = condition
            return {
              orderBy: jest.fn().mockResolvedValue([]),
            }
          }),
        })),
      })),
    }

    const drizzle = {
      db,
      schema: {
        emojiPack,
        emojiAsset,
        emojiRecentUsage,
      },
    } as unknown as DrizzleService

    const service = new EmojiCatalogService(drizzle)

    await service.listCatalog({ scene: EmojiSceneEnum.CHAT })

    expect(compileCondition(capturedCondition)).toContain(
      '"emoji_pack"."visible_in_picker"',
    )
  })

  it('does not add scene filtering to catalog queries when scene is omitted', async () => {
    let capturedCondition: unknown

    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn((condition: unknown) => {
            capturedCondition = condition
            return {
              orderBy: jest.fn().mockResolvedValue([]),
            }
          }),
        })),
      })),
    }

    const drizzle = {
      db,
      schema: {
        emojiPack,
        emojiAsset,
        emojiRecentUsage,
      },
    } as unknown as DrizzleService

    const service = new EmojiCatalogService(drizzle)

    await service.listCatalog({})

    const sql = compileCondition(capturedCondition)
    expect(sql).toContain('"emoji_pack"."visible_in_picker"')
    expect(sql).not.toContain('"emoji_pack"."scene_type"')
  })

  it('adds visibleInPicker filtering to search queries', async () => {
    let capturedCondition: unknown

    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn((condition: unknown) => {
              capturedCondition = condition
              return {
                orderBy: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue([]),
                })),
              }
            }),
          })),
        })),
      })),
    }

    const drizzle = {
      db,
      schema: {
        emojiPack,
        emojiAsset,
        emojiRecentUsage,
      },
    } as unknown as DrizzleService

    const service = new EmojiCatalogService(drizzle)

    await service.search({
      scene: EmojiSceneEnum.CHAT,
      q: 'smile',
      limit: 10,
    })

    expect(compileCondition(capturedCondition)).toContain(
      '"emoji_pack"."visible_in_picker"',
    )
  })

  it('does not add scene filtering to search queries when scene is omitted', async () => {
    let capturedCondition: unknown

    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            where: jest.fn((condition: unknown) => {
              capturedCondition = condition
              return {
                orderBy: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue([]),
                })),
              }
            }),
          })),
        })),
      })),
    }

    const drizzle = {
      db,
      schema: {
        emojiPack,
        emojiAsset,
        emojiRecentUsage,
      },
    } as unknown as DrizzleService

    const service = new EmojiCatalogService(drizzle)

    await service.search({
      q: 'smile',
      limit: 10,
    })

    const sql = compileCondition(capturedCondition)
    expect(sql).toContain('"emoji_pack"."visible_in_picker"')
    expect(sql).not.toContain('"emoji_pack"."scene_type"')
  })

  it('adds visibleInPicker filtering to recent queries', async () => {
    let capturedCondition: unknown

    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            innerJoin: jest.fn(() => ({
              where: jest.fn((condition: unknown) => {
                capturedCondition = condition
                return {
                  orderBy: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue([]),
                  })),
                }
              }),
            })),
          })),
        })),
      })),
    }

    const drizzle = {
      db,
      schema: {
        emojiPack,
        emojiAsset,
        emojiRecentUsage,
      },
    } as unknown as DrizzleService

    const service = new EmojiCatalogService(drizzle)

    await service.listRecent({
      userId: 1,
      scene: EmojiSceneEnum.CHAT,
      limit: 10,
    })

    expect(compileCondition(capturedCondition)).toContain(
      '"emoji_pack"."visible_in_picker"',
    )
  })

  it('aggregates recent queries across scenes when scene is omitted', async () => {
    let capturedCondition: unknown
    const groupBy = jest.fn(() => ({
      orderBy: jest.fn(() => ({
        limit: jest.fn().mockResolvedValue([]),
      })),
    }))

    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          innerJoin: jest.fn(() => ({
            innerJoin: jest.fn(() => ({
              where: jest.fn((condition: unknown) => {
                capturedCondition = condition
                return {
                  groupBy,
                  orderBy: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue([]),
                  })),
                }
              }),
            })),
          })),
        })),
      })),
    }

    const drizzle = {
      db,
      schema: {
        emojiPack,
        emojiAsset,
        emojiRecentUsage,
      },
    } as unknown as DrizzleService

    const service = new EmojiCatalogService(drizzle)

    await service.listRecent({
      userId: 1,
      limit: 10,
    })

    const sql = compileCondition(capturedCondition)
    expect(sql).toContain('"emoji_pack"."visible_in_picker"')
    expect(sql).not.toContain('"emoji_recent_usage"."scene"')
    expect(sql).not.toContain('"emoji_pack"."scene_type"')
    expect(groupBy).toHaveBeenCalledWith(
      emojiAsset.id,
      emojiAsset.kind,
      emojiAsset.shortcode,
      emojiAsset.unicodeSequence,
      emojiAsset.imageUrl,
      emojiAsset.staticUrl,
      emojiAsset.isAnimated,
      emojiAsset.category,
      emojiAsset.keywords,
      emojiPack.id,
      emojiPack.code,
      emojiPack.name,
      emojiPack.iconUrl,
      emojiPack.sortOrder,
      emojiAsset.sortOrder,
    )
  })
})
