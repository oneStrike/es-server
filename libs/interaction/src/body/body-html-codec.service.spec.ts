/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common'
import { BodySceneEnum } from './body.constant'
import { BodyHtmlCodecService } from './body-html-codec.service'
import { BodyValidatorService } from './body-validator.service'

describe('BodyHtmlCodecService', () => {
  function createService() {
    return new BodyHtmlCodecService(new BodyValidatorService())
  }

  it('parses whitelisted html into canonical topic body nodes', () => {
    const service = createService()

    expect(
      service.parseHtmlOrThrow(
        '<p>欢迎 <span data-node="mention" data-user-id="9" data-nickname="测试用户">@测试用户</span><br /><img data-node="emoji" data-shortcode="smile" alt=":smile:" /></p>',
        BodySceneEnum.TOPIC,
      ),
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '欢迎 ' },
            { type: 'mentionUser', userId: 9, nickname: '测试用户' },
            { type: 'hardBreak' },
            { type: 'emojiCustom', shortcode: 'smile' },
          ],
        },
      ],
    })
  })

  it('parses frontend canonical anchors into mention and hashtag nodes', () => {
    const service = createService()
    const html = [
      '<p>',
      '<a data-node="mention" data-user-id="920043" data-nickname="用户920043" href="/pages/usercenter/usercenter?userId=920043">@用户920043</a>',
      '<a data-node="mention" data-user-id="312278" data-nickname="用户312278" href="/pages/usercenter/usercenter?userId=312278">@用户312278</a>',
      '<a data-node="hashtag" data-hashtag-id="77" data-slug="typescript" data-display-name="TypeScript" href="/pages/forumsection/forumsearch?mode=hashtag&amp;hashtagId=77&amp;slug=typescript&amp;keyword=TypeScript">#TypeScript</a>',
      '<img data-node="emoji" data-shortcode="smile" alt=":smile:" />',
      '</p>',
    ].join('')

    expect(service.parseHtmlOrThrow(html, BodySceneEnum.TOPIC)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mentionUser', userId: 920043, nickname: '用户920043' },
            { type: 'mentionUser', userId: 312278, nickname: '用户312278' },
            {
              type: 'forumHashtag',
              hashtagId: 77,
              slug: 'typescript',
              displayName: 'TypeScript',
            },
            { type: 'emojiCustom', shortcode: 'smile' },
          ],
        },
      ],
    })
  })

  it('falls back unsupported data-node inline nodes to plain text', () => {
    const service = createService()

    expect(
      service.parseHtmlOrThrow(
        '<p>前<a data-node="profile" href="/pages/usercenter/usercenter?userId=9">@测试用户</a><span data-node="unknown">#未知节点</span>后</p>',
        BodySceneEnum.TOPIC,
      ),
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '前' },
            { type: 'text', text: '@测试用户' },
            { type: 'text', text: '#未知节点' },
            { type: 'text', text: '后' },
          ],
        },
      ],
    })
  })

  it('renders canonical body into normalized html', () => {
    const service = createService()

    expect(
      service.renderHtml(
        {
          type: 'doc',
          content: [
            {
              type: 'blockquote',
              content: [{ type: 'text', text: '先写能跑的' }],
            },
          ],
        },
        BodySceneEnum.TOPIC,
      ),
    ).toBe('<blockquote>先写能跑的</blockquote>')
  })

  it('rejects unsafe link href protocols while parsing html', () => {
    const service = createService()

    for (const href of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdA==',
    ]) {
      expect(() =>
        service.parseHtmlOrThrow(
          `<p><a href="${href}">危险链接</a></p>`,
          BodySceneEnum.TOPIC,
        ),
      ).toThrow(BadRequestException)
    }

    expect(() =>
      service.parseHtmlOrThrow(
        '<p><a data-node="mention" data-user-id="9" data-nickname="测试用户" href="javascript:alert(1)">@测试用户</a></p>',
        BodySceneEnum.TOPIC,
      ),
    ).toThrow(BadRequestException)
  })

  it('rejects unsafe link href protocols while rendering canonical body', () => {
    const service = createService()

    expect(() =>
      service.renderHtml(
        {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: '危险链接',
                  marks: [{ type: 'link', href: 'javascript:alert(1)' }],
                },
              ],
            },
          ],
        },
        BodySceneEnum.TOPIC,
      ),
    ).toThrow(BadRequestException)
  })

  it('parses html rendered for unicode emoji nodes', () => {
    const service = createService()
    const body = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph' as const,
          content: [{ type: 'emojiUnicode' as const, unicodeSequence: '😀' }],
        },
      ],
    }

    const rendered = service.renderHtml(body, BodySceneEnum.COMMENT)

    expect(service.parseHtmlOrThrow(rendered, BodySceneEnum.COMMENT)).toEqual(
      body,
    )
  })

  it('rejects unsupported html tags', () => {
    const service = createService()

    expect(() =>
      service.parseHtmlOrThrow(
        '<table><tr><td>bad</td></tr></table>',
        BodySceneEnum.TOPIC,
      ),
    ).toThrow(BadRequestException)
  })
})
