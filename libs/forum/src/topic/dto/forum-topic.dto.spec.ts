import 'reflect-metadata'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

describe('forum-topic dto plain mention contract', () => {
  it('documents create topic plain mentions as required structured metadata', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { CreateUserForumTopicDto } = require('./forum-topic.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateUserForumTopicDto.prototype,
      'mentions',
    ) as {
      description?: string
      required?: boolean
    }

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata?.description).toBe(
      '正文中的结构化提及列表；仅 bodyMode=plain 时必传，无提及时传空数组',
    )
    expect(metadata?.required).toBe(false)
  })

  it('documents update topic plain mentions as required structured metadata', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { UpdateForumTopicDto } = require('./forum-topic.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      UpdateForumTopicDto.prototype,
      'mentions',
    ) as {
      description?: string
      required?: boolean
    }

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata?.description).toBe(
      '正文中的结构化提及列表；仅 bodyMode=plain 时必传，无提及时传空数组',
    )
    expect(metadata?.required).toBe(false)
  })

  it('documents topic bodyTokens examples with forum hashtag nodes', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { BaseForumTopicDto } = require('./forum-topic.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      BaseForumTopicDto.prototype,
      'bodyTokens',
    ) as {
      example?: Array<{ type?: string }>
    }

    process.env.NODE_ENV = originalNodeEnv

    expect(
      metadata?.example?.some((item) => item.type === 'forumHashtag'),
    ).toBe(true)
  })
})
