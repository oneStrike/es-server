import 'reflect-metadata'
import type { FastifyReply } from 'fastify'
import { BusinessErrorCode } from '@libs/platform/constant'
import { IS_PUBLIC_KEY } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { AGREEMENT_HTML_CSP } from '@libs/app-content/agreement/agreement-html'
import { QueryPublishedAgreementDto } from '@libs/app-content/agreement/dto/agreement.dto'
import { SystemController } from './system.controller'

type AgreementServiceMock = {
  getAllLatest: jest.Mock
  findOne: jest.Mock
}

type ReplyMock = {
  header: jest.Mock
  type: jest.Mock
  send: jest.Mock
}

type SystemControllerTestApi = {
  getAllLatest: (
    query: QueryPublishedAgreementDto,
  ) => Promise<Array<Record<string, unknown>>>
  findOne: (query: IdDto) => Promise<Record<string, unknown>>
  accessAgreement: (query: IdDto, reply: FastifyReply) => Promise<unknown>
}

function createAgreementRow(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: '用户协议',
    content: '<p>协议正文</p>',
    version: '2026.05',
    isForce: false,
    showInAuth: true,
    isPublished: true,
    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...extra,
  }
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

function createController(agreementService: AgreementServiceMock) {
  const ControllerCtor = SystemController as unknown as new (
    ...args: unknown[]
  ) => SystemController

  return new ControllerCtor(
    {},
    agreementService,
    {},
    {},
    {},
  ) as unknown as SystemControllerTestApi
}

describe('SystemController agreement html access contract', () => {
  let agreementService: AgreementServiceMock
  let controller: SystemControllerTestApi

  beforeEach(() => {
    agreementService = {
      getAllLatest: jest.fn(),
      findOne: jest.fn(),
    }
    controller = createController(agreementService)
  })

  it('marks the app agreement HTML access route as public and documents text/html', () => {
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        SystemController.prototype.accessAgreement,
      ),
    ).toBe(true)

    const responseMetadata = Reflect.getMetadata(
      DECORATORS.API_RESPONSE,
      SystemController.prototype.accessAgreement,
    ) as Record<string, { content?: Record<string, unknown> }> | undefined

    expect(responseMetadata?.['200']?.content).toHaveProperty('text/html')
  })

  it('serves published agreements as hardened html without JSON envelope', async () => {
    agreementService.findOne.mockResolvedValue(
      createAgreementRow(5, {
        title: '<用户协议>',
        version: 'v<1>',
        content: '<p>协议正文</p>',
      }),
    )
    const reply = createReplyMock()

    await controller.accessAgreement(
      { id: 5 },
      reply as unknown as FastifyReply,
    )

    expect(agreementService.findOne).toHaveBeenCalledWith(
      { id: 5 },
      { publishedOnly: true },
    )
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

  it('preserves not-found semantics for unpublished or missing agreements', async () => {
    const error = new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      '协议不存在',
    )
    agreementService.findOne.mockRejectedValue(error)
    const reply = createReplyMock()

    await expect(
      controller.accessAgreement({ id: 404 }, reply as unknown as FastifyReply),
    ).rejects.toBe(error)
    expect(agreementService.findOne).toHaveBeenCalledWith(
      { id: 404 },
      { publishedOnly: true },
    )
    expect(reply.send).not.toHaveBeenCalled()
  })

  it('keeps existing app agreement JSON list response undecorated', async () => {
    const query = { showInAuth: true }
    agreementService.getAllLatest.mockResolvedValue([
      createAgreementRow(12, { content: undefined }),
    ])

    const result = await controller.getAllLatest(query)

    expect(agreementService.getAllLatest).toHaveBeenCalledWith(query)
    expect(result[0]).not.toHaveProperty('accessPath')
    expect(result[0]).not.toHaveProperty('accessUrl')
  })

  it('keeps existing app agreement JSON detail behavior', async () => {
    agreementService.findOne.mockResolvedValue(createAgreementRow(77))

    const result = await controller.findOne({ id: 77 })

    expect(agreementService.findOne).toHaveBeenCalledWith(
      { id: 77 },
      { publishedOnly: true },
    )
    expect(result).not.toHaveProperty('accessPath')
    expect(result).not.toHaveProperty('accessUrl')
  })
})
