import 'reflect-metadata'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

describe('emoji dto scene contract', () => {
  it('documents omitted scene as all scenes instead of chat default', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { QueryEmojiCatalogDto } = require('./emoji.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      QueryEmojiCatalogDto.prototype,
      'scene',
    ) as
      | {
          default?: unknown
          description?: string
          required?: boolean
        }
      | undefined

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata?.description).toBe(
      '场景（1=聊天；2=评论；3=论坛主题；不传返回全部场景）',
    )
    expect(metadata?.required).toBe(false)
    expect(metadata?.default).toBeUndefined()
  })
})
