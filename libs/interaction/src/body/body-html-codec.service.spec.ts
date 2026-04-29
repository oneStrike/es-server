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

    for (const href of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdA==']) {
      expect(() =>
        service.parseHtmlOrThrow(
          `<p><a href="${href}">危险链接</a></p>`,
          BodySceneEnum.TOPIC,
        ),
      ).toThrow(BadRequestException)
    }
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

    expect(service.parseHtmlOrThrow(rendered, BodySceneEnum.COMMENT)).toEqual(body)
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
