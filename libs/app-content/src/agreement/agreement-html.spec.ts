import type { FastifyReply } from 'fastify'
import { AGREEMENT_HTML_CSP, sendAgreementHtml } from './agreement-html'

type ReplyMock = {
  header: jest.Mock
  type: jest.Mock
  send: jest.Mock
}

function createReplyMock() {
  const reply: ReplyMock = {
    header: jest.fn(),
    type: jest.fn(),
    send: jest.fn(),
  }

  reply.header.mockReturnValue(reply)
  reply.type.mockReturnValue(reply)

  return reply
}

describe('sendAgreementHtml', () => {
  it('sends hardened HTML while preserving managed agreement content', () => {
    const reply = createReplyMock()

    sendAgreementHtml(reply as unknown as FastifyReply, {
      title: '<用户协议>',
      version: 'v<1>',
      content: '<p>协议正文</p>',
    })

    expect(reply.header).toHaveBeenCalledWith(
      'Content-Security-Policy',
      AGREEMENT_HTML_CSP,
    )
    expect(reply.header).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff',
    )
    expect(reply.header).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer')
    expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'no-store')
    expect(reply.header).toHaveBeenCalledWith(
      'X-Robots-Tag',
      'noindex, nofollow, noarchive',
    )
    expect(reply.type).toHaveBeenCalledWith('text/html; charset=utf-8')

    const html = reply.send.mock.calls[0]?.[0] as string
    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('&lt;用户协议&gt;')
    expect(html).toContain('v&lt;1&gt;')
    expect(html).toContain('<p>协议正文</p>')
    expect(html).not.toContain('"message":"success"')
  })
})
