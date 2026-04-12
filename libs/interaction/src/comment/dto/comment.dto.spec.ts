import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { CreateCommentBodyDto, ReplyCommentBodyDto } from './comment.dto'

describe('comment dto write contract', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  })

  it('preserves mentions for create comment requests', async () => {
    const transformed = await pipe.transform(
      {
        targetType: 5,
        targetId: 7,
        content: '欢迎 @测试用户',
        mentions: [
          {
            userId: 9,
            nickname: '测试用户',
            start: 3,
            end: 8,
          },
        ],
      },
      {
        type: 'body',
        metatype: CreateCommentBodyDto,
      },
    )

    expect(transformed).toMatchObject({
      targetType: 5,
      targetId: 7,
      content: '欢迎 @测试用户',
      mentions: [
        {
          userId: 9,
          nickname: '测试用户',
          start: 3,
          end: 8,
        },
      ],
    })
  })

  it('preserves mentions for reply comment requests', async () => {
    const transformed = await pipe.transform(
      {
        replyToId: 11,
        content: '回复 @测试用户',
        mentions: [
          {
            userId: 9,
            nickname: '测试用户',
            start: 3,
            end: 8,
          },
        ],
      },
      {
        type: 'body',
        metatype: ReplyCommentBodyDto,
      },
    )

    expect(transformed).toMatchObject({
      replyToId: 11,
      content: '回复 @测试用户',
      mentions: [
        {
          userId: 9,
          nickname: '测试用户',
          start: 3,
          end: 8,
        },
      ],
    })
  })
})
