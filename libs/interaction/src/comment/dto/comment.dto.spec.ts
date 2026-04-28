import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { BaseSensitiveWordHitDto } from '@libs/sensitive-word/dto/sensitive-word.dto'
import { BaseCommentDto } from './comment.dto'

describe('comment.dto sensitive-word hit contract', () => {
  it('transforms sensitiveWordHits into structured hit objects', () => {
    const dto = plainToInstance(BaseCommentDto, {
      sensitiveWordHits: [
        {
          word: '测试',
          start: 0,
          end: 1,
          level: 2,
          type: 5,
        },
      ],
    })

    expect(dto.sensitiveWordHits?.[0]).toBeInstanceOf(BaseSensitiveWordHitDto)
  })

  it('documents create-comment content as raw input text instead of a derived field', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { CreateCommentBodyDto } = require('./comment.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateCommentBodyDto.prototype,
      'content',
    ) as {
      description?: string
    }

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata?.description).toBe(
      '评论正文纯文本；写入时为原始输入，读取时为 canonical body 派生值',
    )
  })

  it('documents create-comment mentions as required structured metadata', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { CreateCommentBodyDto } = require('./comment.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateCommentBodyDto.prototype,
      'mentions',
    ) as {
      description?: string
      required?: boolean
    }

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata?.description).toBe(
      '正文中的结构化提及列表；无提及时传空数组',
    )
    expect(metadata?.required).toBe(true)
  })

  it('documents reply-comment mentions as required structured metadata', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { ReplyCommentBodyDto } = require('./comment.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ReplyCommentBodyDto.prototype,
      'mentions',
    ) as {
      description?: string
      required?: boolean
    }

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata?.description).toBe(
      '正文中的结构化提及列表；无提及时传空数组',
    )
    expect(metadata?.required).toBe(true)
  })

  it('documents comment bodyTokens examples with forum hashtag nodes', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { BaseCommentDto } = require('./comment.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      BaseCommentDto.prototype,
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
