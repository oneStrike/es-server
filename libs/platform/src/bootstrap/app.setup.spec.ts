import type { AppConfigInterface } from '@libs/platform/types'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { setupCompression } from './compression'
import { setupMultipart } from './multipart'
import { setupApp } from './app.setup'
import { setupSwagger } from './swagger'

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
      enable: true,
      path: 'api-doc',
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

describe('setupApp', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('registers Swagger before compression to keep docs routes readable', async () => {
    const app = createAppDouble()
    const fastifyAdapter = new FastifyAdapter()
    const callOrder: string[] = []

    ;(setupSwagger as jest.Mock).mockImplementation(() => {
      callOrder.push('swagger')
    })
    ;(setupCompression as jest.Mock).mockImplementation(async () => {
      callOrder.push('compression')
    })
    ;(setupMultipart as jest.Mock).mockImplementation(async () => {
      callOrder.push('multipart')
    })

    await setupApp(app as never, fastifyAdapter, createAppConfig())

    expect(callOrder).toEqual(['swagger', 'compression', 'multipart'])
  })
})
