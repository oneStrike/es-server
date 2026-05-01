import type { BodyDoc } from '@libs/interaction/body/body.type'
import { buildForumTopicContentPreview } from './forum-topic-preview.helper'

describe('buildForumTopicContentPreview', () => {
  it('keeps mention and hashtag segments clickable in topic previews', () => {
    const body: BodyDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '欢迎 ' },
            { type: 'mentionUser', userId: 9, nickname: '测试用户' },
            { type: 'text', text: ' 关注 ' },
            {
              type: 'forumHashtag',
              hashtagId: 77,
              slug: 'typescript',
              displayName: 'TypeScript',
            },
          ],
        },
      ],
    }

    const preview = buildForumTopicContentPreview(body)

    expect(preview).toEqual({
      plainText: '欢迎 @测试用户 关注 #TypeScript',
      segments: [
        { type: 'text', text: '欢迎 ' },
        { type: 'mention', text: '@测试用户', userId: 9, nickname: '测试用户' },
        { type: 'text', text: ' 关注 ' },
        {
          type: 'hashtag',
          text: '#TypeScript',
          hashtagId: 77,
          slug: 'typescript',
          displayName: 'TypeScript',
        },
      ],
    })
  })

  it('caps preview text by character count', () => {
    const body: BodyDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'abcdef' }],
        },
      ],
    }

    const preview = buildForumTopicContentPreview(body, {
      maxLength: 3,
    })

    expect(preview).toEqual({
      plainText: 'abc',
      segments: [{ type: 'text', text: 'abc' }],
    })
  })

  it('keeps canonical spacing between top-level blocks', () => {
    const body: BodyDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '第一段' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '第二段' }],
        },
      ],
    }

    const preview = buildForumTopicContentPreview(body)

    expect(preview).toEqual({
      plainText: '第一段\n\n第二段',
      segments: [{ type: 'text', text: '第一段\n\n第二段' }],
    })
  })

  it('does not expose partially truncated entities as clickable segments', () => {
    const body: BodyDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'mentionUser', userId: 9, nickname: '测试用户' }],
        },
      ],
    }

    const preview = buildForumTopicContentPreview(body, {
      maxLength: 3,
    })

    expect(preview).toEqual({
      plainText: '@测试',
      segments: [{ type: 'text', text: '@测试' }],
    })
  })

  it('caps preview segments by configured segment count', () => {
    const body: BodyDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'A' },
            { type: 'mentionUser', userId: 9, nickname: '小明' },
            { type: 'text', text: 'B' },
            {
              type: 'forumHashtag',
              hashtagId: 77,
              slug: 'typescript',
              displayName: 'TypeScript',
            },
          ],
        },
      ],
    }

    const preview = buildForumTopicContentPreview(body, {
      maxSegments: 3,
    })

    expect(preview).toEqual({
      plainText: 'A@小明B',
      segments: [
        { type: 'text', text: 'A' },
        { type: 'mention', text: '@小明', userId: 9, nickname: '小明' },
        { type: 'text', text: 'B' },
      ],
    })
  })
})
