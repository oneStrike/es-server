import type { BodyToken } from '@libs/interaction/body/body-token.type'
import { buildForumTopicContentPreview } from './forum-topic-preview.helper'

describe('buildForumTopicContentPreview', () => {
  it('keeps mention, hashtag and emoji segments semantic in topic previews', () => {
    const bodyTokens: BodyToken[] = [
      { type: 'text', text: '欢迎 ' },
      {
        type: 'mentionUser',
        text: '@测试用户',
        userId: 9,
        nickname: '测试用户',
      },
      { type: 'text', text: ' 使用 ' },
      {
        type: 'emojiCustom',
        emojiAssetId: 1001,
        shortcode: 'smile',
        packCode: 'default',
        imageUrl: 'https://cdn.example.com/emoji/smile.gif',
        staticUrl: 'https://cdn.example.com/emoji/smile.png',
        isAnimated: true,
      },
      { type: 'text', text: ' 关注 ' },
      {
        type: 'forumHashtag',
        text: '#TypeScript',
        hashtagId: 77,
        slug: 'typescript',
        displayName: 'TypeScript',
      },
      { type: 'text', text: ' ' },
      { type: 'emojiUnicode', unicodeSequence: '😀', emojiAssetId: 1002 },
    ]

    const preview = buildForumTopicContentPreview(bodyTokens)

    expect(preview).toEqual({
      plainText: '欢迎 @测试用户 使用 :smile: 关注 #TypeScript 😀',
      segments: [
        { type: 'text', text: '欢迎 ' },
        { type: 'mention', text: '@测试用户', userId: 9, nickname: '测试用户' },
        { type: 'text', text: ' 使用 ' },
        {
          type: 'emoji',
          text: ':smile:',
          kind: 2,
          shortcode: 'smile',
          emojiAssetId: 1001,
        },
        { type: 'text', text: ' 关注 ' },
        {
          type: 'hashtag',
          text: '#TypeScript',
          hashtagId: 77,
          slug: 'typescript',
          displayName: 'TypeScript',
        },
        { type: 'text', text: ' ' },
        {
          type: 'emoji',
          text: '😀',
          kind: 1,
          unicodeSequence: '😀',
          emojiAssetId: 1002,
        },
      ],
    })
  })

  it('caps preview text by character count', () => {
    const bodyTokens: BodyToken[] = [{ type: 'text', text: 'abcdef' }]

    const preview = buildForumTopicContentPreview(bodyTokens, {
      maxLength: 3,
    })

    expect(preview).toEqual({
      plainText: 'abc',
      segments: [{ type: 'text', text: 'abc' }],
    })
  })

  it('keeps compiler-provided spacing between top-level blocks', () => {
    const bodyTokens: BodyToken[] = [{ type: 'text', text: '第一段\n\n第二段' }]

    const preview = buildForumTopicContentPreview(bodyTokens)

    expect(preview).toEqual({
      plainText: '第一段\n\n第二段',
      segments: [{ type: 'text', text: '第一段\n\n第二段' }],
    })
  })

  it('does not expose partially truncated entities as clickable segments', () => {
    const bodyTokens: BodyToken[] = [
      {
        type: 'mentionUser',
        text: '@测试用户',
        userId: 9,
        nickname: '测试用户',
      },
    ]

    const preview = buildForumTopicContentPreview(bodyTokens, {
      maxLength: 3,
    })

    expect(preview).toEqual({
      plainText: '@测试',
      segments: [{ type: 'text', text: '@测试' }],
    })
  })

  it('does not expose partially truncated emoji as semantic segments', () => {
    const bodyTokens: BodyToken[] = [
      {
        type: 'emojiCustom',
        emojiAssetId: 1001,
        shortcode: 'smile',
        packCode: 'default',
        imageUrl: 'https://cdn.example.com/emoji/smile.gif',
        isAnimated: true,
      },
    ]

    const preview = buildForumTopicContentPreview(bodyTokens, {
      maxLength: 4,
    })

    expect(preview).toEqual({
      plainText: ':smi',
      segments: [{ type: 'text', text: ':smi' }],
    })
  })

  it('keeps unresolved custom emoji semantic without display resource fields', () => {
    const bodyTokens: BodyToken[] = [
      {
        type: 'emojiCustom',
        shortcode: 'missing',
      },
    ]

    const preview = buildForumTopicContentPreview(bodyTokens)

    expect(preview).toEqual({
      plainText: ':missing:',
      segments: [
        {
          type: 'emoji',
          text: ':missing:',
          kind: 2,
          shortcode: 'missing',
        },
      ],
    })
  })

  it('caps preview segments by configured segment count', () => {
    const bodyTokens: BodyToken[] = [
      { type: 'text', text: 'A' },
      { type: 'mentionUser', text: '@小明', userId: 9, nickname: '小明' },
      { type: 'text', text: 'B' },
      {
        type: 'forumHashtag',
        text: '#TypeScript',
        hashtagId: 77,
        slug: 'typescript',
        displayName: 'TypeScript',
      },
    ]

    const preview = buildForumTopicContentPreview(bodyTokens, {
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
