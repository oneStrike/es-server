import 'reflect-metadata'
import { DECORATORS } from '@nestjs/swagger/dist/constants'

describe('forum-topic dto html contract', () => {
  it('documents create topic html as the only write contract', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { CreateUserForumTopicDto } = require('./forum-topic.dto')
    const htmlMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateUserForumTopicDto.prototype,
      'html',
    ) as {
      description?: string
      required?: boolean
    }
    const bodyModeMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateUserForumTopicDto.prototype,
      'bodyMode',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(htmlMetadata?.description).toBe(
      '正文 HTML；唯一写入合同，纯文本编辑器也需输出最小 HTML',
    )
    expect(htmlMetadata?.required).toBe(true)
    expect(bodyModeMetadata).toBeUndefined()
  })

  it('documents update topic html as the only write contract', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { UpdateForumTopicDto } = require('./forum-topic.dto')
    const htmlMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      UpdateForumTopicDto.prototype,
      'html',
    ) as {
      description?: string
      required?: boolean
    }
    const plainTextMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      UpdateForumTopicDto.prototype,
      'plainText',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(htmlMetadata?.description).toBe(
      '正文 HTML；唯一写入合同，纯文本编辑器也需输出最小 HTML',
    )
    expect(plainTextMetadata).toBeUndefined()
  })

  it('does not expose topic bodyTokens in public topic dto', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { PublicForumTopicDetailDto } = require('./forum-topic.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      PublicForumTopicDetailDto.prototype,
      'bodyTokens',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata).toBeUndefined()
  })

  it('documents public topic list preview as structured contentPreview only', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { PublicForumTopicPageItemDto } = require('./forum-topic.dto')
    const contentPreviewMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      PublicForumTopicPageItemDto.prototype,
      'contentPreview',
    ) as {
      description?: string
      required?: boolean
    }
    const contentSnippetMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      PublicForumTopicPageItemDto.prototype,
      'contentSnippet',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(contentPreviewMetadata?.description).toBe(
      '主题列表预览；包含普通文本、@用户、#话题片段',
    )
    expect(contentPreviewMetadata?.required).toBe(true)
    expect(contentSnippetMetadata).toBeUndefined()
  })
})
