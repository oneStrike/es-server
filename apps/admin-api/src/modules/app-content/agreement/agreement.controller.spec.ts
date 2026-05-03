import 'reflect-metadata'
import type { FastifyReply } from 'fastify'
import { readFileSync } from 'node:fs'
import { BusinessErrorCode } from '@libs/platform/constant'
import { IS_PUBLIC_KEY } from '@libs/platform/decorators'
import { IdDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { QueryAgreementDto } from '@libs/app-content/agreement/dto/agreement.dto'
import { AgreementController } from './agreement.controller'

type AgreementControllerTestApi = {
  list: (query: QueryAgreementDto) => Promise<{
    list: Array<Record<string, unknown>>
    total: number
    pageIndex: number
    pageSize: number
  }>
  detail: (query: IdDto) => Promise<Record<string, unknown>>
  access: (query: IdDto, reply: FastifyReply) => Promise<unknown>
}

type AgreementServiceMock = {
  findPage: jest.Mock
  findOne: jest.Mock
}

type ConfigServiceMock = {
  get: jest.Mock
}

type ReplyMock = {
  header: jest.Mock
  type: jest.Mock
  send: jest.Mock
}

function createAgreementRow(
  id: number,
  extra: Record<string, unknown> = {},
  includeContent = true,
) {
  return {
    id,
    title: '用户协议',
    ...(includeContent ? { content: '<p>协议正文</p>' } : {}),
    version: '2026.05',
    isForce: false,
    showInAuth: true,
    isPublished: false,
    publishedAt: null,
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

function createController(
  agreementService: AgreementServiceMock,
  configService: ConfigServiceMock,
) {
  const ControllerCtor = AgreementController as unknown as new (
    ...args: unknown[]
  ) => AgreementController

  return new ControllerCtor(
    agreementService,
    configService,
  ) as unknown as AgreementControllerTestApi
}

const AGREEMENT_HTML_CSP =
  "default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; img-src https: data:; media-src https: data:; style-src 'unsafe-inline'"

describe('AgreementController admin access path contract', () => {
  let agreementService: AgreementServiceMock
  let configService: ConfigServiceMock
  let controller: AgreementControllerTestApi

  beforeEach(() => {
    agreementService = {
      findPage: jest.fn(),
      findOne: jest.fn(),
    }
    configService = {
      get: jest.fn((key: string) =>
        key === 'app.globalApiPrefix' ? 'api' : undefined,
      ),
    }
    controller = createController(agreementService, configService)
  })

  it('adds only relative access paths to admin page rows', async () => {
    agreementService.findPage.mockResolvedValue({
      list: [createAgreementRow(12, {}, false)],
      total: 1,
      pageIndex: 1,
      pageSize: 15,
    })

    const result = await controller.list({} as QueryAgreementDto)

    expect(result).toMatchObject({
      total: 1,
      pageIndex: 1,
      pageSize: 15,
    })
    expect(result.list[0]).toMatchObject({
      id: 12,
      accessPath: '/api/admin/agreement/access?id=12',
    })
    expect(result.list[0]).not.toHaveProperty('accessUrl')
    expect(result.list[0]).not.toHaveProperty('content')
  })

  it('adds only a relative access path to admin detail', async () => {
    agreementService.findOne.mockResolvedValue(createAgreementRow(77))

    const result = await controller.detail({ id: 77 })

    expect(result).toMatchObject({
      id: 77,
      accessPath: '/api/admin/agreement/access?id=77',
    })
    expect(result).not.toHaveProperty('accessUrl')
  })

  it('marks the direct HTML access route as public and documents text/html', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, AgreementController.prototype.access),
    ).toBe(true)

    const responseMetadata = Reflect.getMetadata(
      DECORATORS.API_RESPONSE,
      AgreementController.prototype.access,
    ) as Record<string, { content?: Record<string, unknown> }> | undefined

    expect(responseMetadata?.['200']?.content).toHaveProperty('text/html')
  })

  it('sends successful agreement access as hardened html without JSON envelope', async () => {
    agreementService.findOne.mockResolvedValue(
      createAgreementRow(5, {
        title: '<用户协议>',
        version: 'v<1>',
        content: '<p>协议正文</p>',
      }),
    )
    const reply = createReplyMock()

    await controller.access({ id: 5 }, reply as unknown as FastifyReply)

    expect(agreementService.findOne).toHaveBeenCalledWith({ id: 5 })
    expect(agreementService.findOne).not.toHaveBeenCalledWith(
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
    expect(html).toContain('&lt;用户协议&gt;')
    expect(html).toContain('v&lt;1&gt;')
    expect(html).toContain('<p>协议正文</p>')
    expect(html).not.toContain('"message":"success"')
  })

  it('preserves agreement not-found business exception on access route', async () => {
    const error = new BusinessException(
      BusinessErrorCode.RESOURCE_NOT_FOUND,
      '协议不存在',
    )
    agreementService.findOne.mockRejectedValue(error)
    const reply = createReplyMock()

    await expect(
      controller.access({ id: 404 }, reply as unknown as FastifyReply),
    ).rejects.toBe(error)
    expect(reply.send).not.toHaveBeenCalled()
  })

  it('does not keep absolute-url request origin code in the controller source', () => {
    const source = readFileSync(
      __filename.replace(/\.spec\.ts$/, '.ts'),
      'utf8',
    )

    expect(source).not.toContain('FastifyRequest')
    expect(source).not.toContain('Req')
    expect(source).not.toContain('accessUrl')
    expect(source).not.toContain('x-forwarded-proto')
    expect(source).not.toContain('x-forwarded-host')
    expect(source).not.toContain('buildRequestOrigin')
    expect(source).not.toContain('readHeaderValue')
    expect(source).not.toContain('headers.host')
    expect(source).not.toContain('req.hostname')
    expect(source).not.toContain('ApiOperation')
    expect(source).not.toContain('ApiProduces')
    expect(source).not.toContain('ApiOkResponse')
    expect(source).toContain('ApiHtmlDoc')
  })
})
