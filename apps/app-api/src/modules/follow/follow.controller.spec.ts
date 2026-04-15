import { FollowController } from './follow.controller'

describe('follow controller', () => {
  const createController = () => {
    const followService = {
      follow: jest.fn(),
      unfollow: jest.fn(),
      checkFollowStatus: jest.fn(),
      getFollowedAuthorPage: jest.fn().mockResolvedValue({ list: [] }),
      getFollowedSectionPage: jest.fn().mockResolvedValue({ list: [] }),
      getFollowingUserPage: jest.fn().mockResolvedValue({ list: [] }),
      getFollowerUserPage: jest.fn().mockResolvedValue({ list: [] }),
    }

    return {
      controller: new FollowController(followService as never),
      followService,
    }
  }

  it('作者关注分页在未传 userId 时回退当前用户', async () => {
    const { controller, followService } = createController()
    const query = {
      pageIndex: 2,
      pageSize: 10,
    }

    await controller.followedAuthorPage(query, 101)

    expect(followService.getFollowedAuthorPage).toHaveBeenCalledWith({
      ...query,
      userId: 101,
    })
  })

  it('用户关注分页在传入 userId 时优先使用查询参数', async () => {
    const { controller, followService } = createController()
    const query = {
      userId: 202,
      pageIndex: 1,
      pageSize: 15,
    }

    await controller.followingUserPage(query, 101)

    expect(followService.getFollowingUserPage).toHaveBeenCalledWith(query)
  })

  it('粉丝分页在未传 userId 时回退当前用户', async () => {
    const { controller, followService } = createController()
    const query = {
      pageIndex: 3,
      pageSize: 20,
    }

    await controller.followerUserPage(query, 88)

    expect(followService.getFollowerUserPage).toHaveBeenCalledWith({
      ...query,
      userId: 88,
    })
  })
})
