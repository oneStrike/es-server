import { NotificationEventConsumer } from './notification-event.consumer'

function createNotificationEventConsumer() {
  const applyCommand = jest.fn().mockResolvedValue({
    action: 'skip',
    reason: 'test-only',
  })
  const recordHandledDispatch = jest.fn()
  const consumer = new NotificationEventConsumer(
    {} as never,
    {
      applyCommand,
    } as never,
    {
      recordHandledDispatch,
    } as never,
    {} as never,
  )

  return {
    consumer,
    mocks: {
      applyCommand,
      recordHandledDispatch,
    },
  }
}

describe('notification-event.consumer', () => {
  it('rejects notification events when receiverUserId is missing', async () => {
    const { consumer, mocks } = createNotificationEventConsumer()

    await expect(
      consumer.consume(
        {
          eventKey: 'comment.liked',
          operatorId: 3,
          context: {
            projectionKey: 'notify:comment:like:1',
            title: '有人点赞了你的评论',
            content: '评论内容',
          },
        } as never,
        {} as never,
      ),
    ).rejects.toThrow(
      'notification event context.receiverUserId must be a positive integer',
    )

    expect(mocks.applyCommand).not.toHaveBeenCalled()
    expect(mocks.recordHandledDispatch).not.toHaveBeenCalled()
  })

  it('normalizes required notification context before applying the projection command', async () => {
    const { consumer, mocks } = createNotificationEventConsumer()

    await consumer.consume(
      {
        eventKey: 'comment.liked',
        operatorId: 3,
        context: {
          receiverUserId: '9',
          projectionKey: ' notify:comment:like:1 ',
          title: ' 有人点赞了你的评论 ',
          content: ' 评论内容 ',
        },
      } as never,
      {} as never,
    )

    expect(mocks.applyCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'append',
        receiverUserId: 9,
        projectionKey: 'notify:comment:like:1',
        title: '有人点赞了你的评论',
        content: '评论内容',
      }),
      expect.anything(),
      expect.anything(),
    )
  })
})
