/// <reference types="jest" />
import { BodyCompilerService } from './body-compiler.service'
import { BodySceneEnum } from './body.constant'
import { createBodyDocFromPlainText } from './body-text.helper'
import { BodyValidatorService } from './body-validator.service'

describe('BodyCompilerService', () => {
  function createHarness() {
    const emojiCatalogService = {
      findCustomAssetsByShortcodes: jest.fn().mockResolvedValue(
        new Map([
          [
            'smile',
            {
              emojiAssetId: 1001,
              shortcode: 'smile',
              packCode: 'default',
              packName: '默认表情',
              imageUrl: 'https://cdn.example.com/emoji/smile.gif',
              staticUrl: 'https://cdn.example.com/emoji/smile.png',
              isAnimated: true,
              ariaLabel: 'default:smile',
            },
          ],
        ]),
      ),
      findUnicodeAssetsBySequences: jest.fn().mockResolvedValue(
        new Map([
          [
            '😀',
            {
              emojiAssetId: 1002,
              unicodeSequence: '😀',
            },
          ],
        ]),
      ),
    }
    const emojiParserService = {
      parse: jest.fn(async ({ body }: { body: string }) => [
        {
          type: 'text',
          text: body,
        },
      ]),
    }

    return {
      compiler: new BodyCompilerService(
        emojiCatalogService as never,
        emojiParserService as never,
      ),
      validator: new BodyValidatorService(),
      emojiCatalogService,
      emojiParserService,
    }
  }

  it('wraps plain text into paragraph and hardBreak nodes', () => {
    expect(createBodyDocFromPlainText('第一行\n第二行\n\n第三段')).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '第一行' },
            { type: 'hardBreak' },
            { type: 'text', text: '第二行' },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '第三段' }],
        },
      ],
    })
  })

  it('materializes plain-text mentions and emoji into canonical inline nodes', () => {
    expect(
      createBodyDocFromPlainText('欢迎 @测试用户 使用 :smile:\n第二行😀', {
        mentions: [
          {
            userId: 9,
            nickname: '测试用户',
            start: 3,
            end: 8,
          },
        ],
      }),
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '欢迎 ' },
            { type: 'mentionUser', userId: 9, nickname: '测试用户' },
            { type: 'text', text: ' 使用 ' },
            { type: 'emojiCustom', shortcode: 'smile' },
            { type: 'hardBreak' },
            { type: 'text', text: '第二行' },
            { type: 'emojiUnicode', unicodeSequence: '😀' },
          ],
        },
      ],
    })
  })

  it('compiles rich topic body into plain text, tokens and mention facts', async () => {
    const harness = createHarness()
    const body = harness.validator.validateBodyOrThrow(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '欢迎 ' },
              { type: 'mentionUser', userId: 9, nickname: '测试用户' },
              { type: 'text', text: ' 使用 ' },
              { type: 'emojiCustom', shortcode: 'smile' },
            ],
          },
          {
            type: 'blockquote',
            content: [{ type: 'emojiUnicode', unicodeSequence: '😀' }],
          },
        ],
      },
      BodySceneEnum.TOPIC,
    )

    await expect(
      harness.compiler.compile(body, BodySceneEnum.TOPIC),
    ).resolves.toEqual({
      body,
      plainText: '欢迎 @测试用户 使用 :smile:\n\n😀',
      bodyTokens: [
        { type: 'text', text: '欢迎 ' },
        {
          type: 'mentionUser',
          userId: 9,
          nickname: '测试用户',
          text: '@测试用户',
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
          ariaLabel: 'default:smile',
        },
        { type: 'text', text: '\n\n' },
        {
          type: 'emojiUnicode',
          unicodeSequence: '😀',
          emojiAssetId: 1002,
        },
      ],
      mentionFacts: [
        {
          userId: 9,
          nickname: '测试用户',
          start: 3,
          end: 8,
          text: '@测试用户',
        },
      ],
      emojiRecentUsageItems: [
        { emojiAssetId: 1001, useCount: 1 },
        { emojiAssetId: 1002, useCount: 1 },
      ],
    })
  })

  it('preserves mention offsets when emoji appears before the mention in plain text', async () => {
    const harness = createHarness()

    const unicodeFirstBody = createBodyDocFromPlainText('😀@测试用户 hello', {
      mentions: [
        {
          userId: 9,
          nickname: '测试用户',
          start: 2,
          end: 7,
        },
      ],
    })

    await expect(
      harness.compiler.compile(unicodeFirstBody, BodySceneEnum.TOPIC),
    ).resolves.toEqual(
      expect.objectContaining({
        plainText: '😀@测试用户 hello',
        mentionFacts: [
          {
            userId: 9,
            nickname: '测试用户',
            start: 2,
            end: 7,
            text: '@测试用户',
          },
        ],
      }),
    )

    const customFirstBody = createBodyDocFromPlainText(':smile:@测试用户', {
      mentions: [
        {
          userId: 9,
          nickname: '测试用户',
          start: 7,
          end: 12,
        },
      ],
    })

    await expect(
      harness.compiler.compile(customFirstBody, BodySceneEnum.TOPIC),
    ).resolves.toEqual(
      expect.objectContaining({
        plainText: ':smile:@测试用户',
        mentionFacts: [
          {
            userId: 9,
            nickname: '测试用户',
            start: 7,
            end: 12,
            text: '@测试用户',
          },
        ],
      }),
    )
  })

  it('keeps explicit forum hashtag nodes in plain text and bodyTokens order', async () => {
    const harness = createHarness()
    const body = harness.validator.validateBodyOrThrow(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: '加入 ' },
              {
                type: 'forumHashtag',
                hashtagId: 77,
                slug: 'typescript',
                displayName: 'TypeScript',
              },
              { type: 'text', text: ' 讨论' },
            ],
          },
        ],
      },
      BodySceneEnum.TOPIC,
    )

    await expect(
      harness.compiler.compile(body, BodySceneEnum.TOPIC),
    ).resolves.toEqual({
      body,
      plainText: '加入 #TypeScript 讨论',
      bodyTokens: [
        { type: 'text', text: '加入 ' },
        {
          type: 'forumHashtag',
          hashtagId: 77,
          slug: 'typescript',
          displayName: 'TypeScript',
          text: '#TypeScript',
        },
        { type: 'text', text: ' 讨论' },
      ],
      mentionFacts: [],
      emojiRecentUsageItems: [],
    })
  })

  it('keeps unresolved explicit custom emoji as semantic tokens without asset fields', async () => {
    const harness = createHarness()
    const body = harness.validator.validateBodyOrThrow(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'emojiCustom', shortcode: 'missing' }],
          },
        ],
      },
      BodySceneEnum.TOPIC,
    )

    await expect(
      harness.compiler.compile(body, BodySceneEnum.TOPIC),
    ).resolves.toEqual({
      body,
      plainText: ':missing:',
      bodyTokens: [
        {
          type: 'emojiCustom',
          shortcode: 'missing',
        },
      ],
      mentionFacts: [],
      emojiRecentUsageItems: [],
    })
  })
})
