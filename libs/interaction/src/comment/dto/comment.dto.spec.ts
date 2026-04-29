import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { BaseSensitiveWordHitDto } from '@libs/sensitive-word/dto/sensitive-word.dto'
import { BaseCommentDto } from './comment.dto'

describe('comment.dto html contract', () => {
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

  it('documents create-comment html as the only write contract', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { CreateCommentBodyDto } = require('./comment.dto')
    const htmlMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateCommentBodyDto.prototype,
      'html',
    ) as {
      description?: string
      required?: boolean
    }
    const contentMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      CreateCommentBodyDto.prototype,
      'content',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(htmlMetadata?.description).toBe('评论正文 HTML；对外唯一正文表示')
    expect(htmlMetadata?.required).toBe(true)
    expect(contentMetadata).toBeUndefined()
  })

  it('documents reply-comment html as the only write contract', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { ReplyCommentBodyDto } = require('./comment.dto')
    const htmlMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ReplyCommentBodyDto.prototype,
      'html',
    ) as {
      description?: string
      required?: boolean
    }
    const mentionsMetadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      ReplyCommentBodyDto.prototype,
      'mentions',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(htmlMetadata?.description).toBe('评论正文 HTML；对外唯一正文表示')
    expect(htmlMetadata?.required).toBe(true)
    expect(mentionsMetadata).toBeUndefined()
  })

  it('does not expose comment bodyTokens in public comment dto', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    jest.resetModules()

    const { TargetCommentItemDto } = require('./comment.dto')
    const metadata = Reflect.getMetadata(
      DECORATORS.API_MODEL_PROPERTIES,
      TargetCommentItemDto.prototype,
      'bodyTokens',
    )

    process.env.NODE_ENV = originalNodeEnv

    expect(metadata).toBeUndefined()
  })
})
