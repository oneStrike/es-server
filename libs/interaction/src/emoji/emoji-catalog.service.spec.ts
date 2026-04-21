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
      '"emoji_pack"."visibleInPicker"',
    )
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
      '"emoji_pack"."visibleInPicker"',
    )
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
      '"emoji_pack"."visibleInPicker"',
    )
  })
})
