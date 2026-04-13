import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { CreateUserForumTopicDto, UpdateForumTopicDto } from './forum-topic.dto'

describe('forum topic dto write contract', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  })

  it('preserves mentions for user create topic requests', async () => {
    const transformed = await pipe.transform(
      {
        sectionId: 7,
        title: '提及主题',
        content: '欢迎 @测试用户 一起讨论',
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
        metatype: CreateUserForumTopicDto,
      },
    )

    expect(transformed).toMatchObject({
      sectionId: 7,
      title: '提及主题',
      content: '欢迎 @测试用户 一起讨论',
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

  it('preserves mentions for update topic requests', async () => {
    const transformed = await pipe.transform(
      {
        id: 101,
        title: '提及主题',
        content: '欢迎 @测试用户 一起讨论',
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
        metatype: UpdateForumTopicDto,
      },
    )

    expect(transformed).toMatchObject({
      id: 101,
      title: '提及主题',
      content: '欢迎 @测试用户 一起讨论',
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

  it('rejects user create topic requests without mentions', async () => {
    await expect(
      pipe.transform(
        {
          sectionId: 7,
          title: '纯文本主题',
          content: '没有提及',
        },
        {
          type: 'body',
          metatype: CreateUserForumTopicDto,
        },
      ),
    ).rejects.toThrow()
  })

  it('rejects update topic requests without mentions', async () => {
    await expect(
      pipe.transform(
        {
          id: 101,
          title: '纯文本主题',
          content: '没有提及',
        },
        {
          type: 'body',
          metatype: UpdateForumTopicDto,
        },
      ),
    ).rejects.toThrow()
  })
})
