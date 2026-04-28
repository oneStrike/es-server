import { ForumUserActionLogService } from './action-log.service'

describe('ForumUserActionLogService', () => {
  it('orders user action logs by createdAt descending', async () => {
    const findPagination = jest.fn().mockResolvedValue({
      list: [],
      total: 0,
      pageIndex: 1,
      pageSize: 20,
    })

    const service = new ForumUserActionLogService({
      db: {},
      schema: {
        forumUserActionLog: {},
      },
      ext: {
        findPagination,
      },
    } as never)

    await service.getActionLogsByUserId({
      userId: 1,
      pageIndex: 1,
      pageSize: 20,
    })

    expect(findPagination).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        orderBy: {
          createdAt: 'desc',
        },
      }),
    )
  })
})
