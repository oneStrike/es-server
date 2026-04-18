import type { AppConfigInterface } from '@libs/platform/types'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { setupApp } from './app.setup'

jest.mock('@libs/platform/utils/env', () => ({
  isDevelopment: () => false,
}))

jest.mock('./compression', () => ({
  setupCompression: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./multipart', () => ({
  setupMultipart: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./swagger', () => ({
  setupSwagger: jest.fn(),
}))

function createAppConfig(): AppConfigInterface {
  return {
    globalApiPrefix: 'api',
    swaggerConfig: {
      enable: false,
      path: 'docs',
      title: 'test',
      description: 'test',
      version: '1.0.0',
    },
  } as AppConfigInterface
}

function createAppDouble() {
  return {
    useLogger: jest.fn(),
    setGlobalPrefix: jest.fn(),
    enableCors: jest.fn(),
    register: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockReturnValue({}),
  }
}

describe('setupApp JSON body parser', () => {
  it('accepts an empty application/json POST body for handlers without params', async () => {
    const fastifyAdapter = new FastifyAdapter()
    const app = createAppDouble()

    await setupApp(app as never, fastifyAdapter, createAppConfig())

    const fastify = fastifyAdapter.getInstance()
    fastify.post('/empty-json', async request => ({ body: request.body ?? null }))

    const response = await fastify.inject({
      method: 'POST',
      url: '/empty-json',
      headers: {
        'content-type': 'application/json',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      body: {},
    })

    await fastify.close()
  })

  it('keeps the default JSON parsing behavior for non-empty bodies', async () => {
    const fastifyAdapter = new FastifyAdapter()
    const app = createAppDouble()

    await setupApp(app as never, fastifyAdapter, createAppConfig())

    const fastify = fastifyAdapter.getInstance()
    fastify.post('/json-body', async request => ({ body: request.body ?? null }))

    const response = await fastify.inject({
      method: 'POST',
      url: '/json-body',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ ok: true }),
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      body: { ok: true },
    })

    await fastify.close()
  })
})
