import { createBodyDocFromPlainText } from '@libs/interaction/body/body-text.helper'
import { ForumHashtagCreateSourceTypeEnum } from './forum-hashtag.constant'
import { ForumHashtagBodyService } from './forum-hashtag-body.service'

describe('ForumHashtagBodyService', () => {
  it('materializes plain text hashtags into canonical body nodes and facts', async () => {
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn().mockResolvedValue([]),
        })),
      })),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          onConflictDoNothing: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([
              {
                id: 77,
                slug: 'typescript',
                displayName: 'TypeScript',
                auditStatus: 1,
                isHidden: false,
                deletedAt: null,
              },
            ]),
          })),
        })),
      })),
    }
    const drizzle = {
      schema: {
        forumHashtag: {
          id: 'id',
          slug: 'slug',
          displayName: 'displayName',
          auditStatus: 'auditStatus',
          isHidden: 'isHidden',
          deletedAt: 'deletedAt',
        },
      },
    }
    const configReader = {
      getForumHashtagConfig: jest.fn().mockReturnValue({
        creationMode: 2,
      }),
      getContentReviewPolicy: jest.fn().mockReturnValue({
        severeAction: { auditStatus: 2, isHidden: true },
        generalAction: { auditStatus: 0, isHidden: false },
        lightAction: { auditStatus: 1, isHidden: false },
        recordHits: true,
      }),
    }
    const sensitiveWordDetectService = {
      getMatchedWordsWithMetadata: jest.fn().mockReturnValue({
        highestLevel: undefined,
        publicHits: [],
      }),
    }

    const service = new ForumHashtagBodyService(
      drizzle as never,
      configReader as never,
      sensitiveWordDetectService as never,
    )

    await expect(
      service.materializeBodyInTx({
        tx: tx as never,
        body: createBodyDocFromPlainText('聊聊 #TypeScript'),
        actorUserId: 9,
        createSourceType: ForumHashtagCreateSourceTypeEnum.TOPIC_BODY,
      }),
    ).resolves.toEqual({
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '聊聊 ' },
              {
                type: 'forumHashtag',
                hashtagId: 77,
                slug: 'typescript',
                displayName: 'TypeScript',
              },
            ],
          },
        ],
      },
      hashtagFacts: [
        {
          hashtagId: 77,
          slug: 'typescript',
          displayName: 'TypeScript',
          occurrenceCount: 1,
        },
      ],
    })
  })
})
