/// <reference types="jest" />

import {
  ForumModeratorPermissionEnum,
  ForumModeratorRoleTypeEnum,
} from '../moderator/moderator.constant'
import { ForumSectionService } from './forum-section.service'

function createThenableBuilder<TResult>(result: TResult) {
  const promise = Promise.resolve(result)
  const builder: Record<string, ReturnType<typeof jest.fn>> & {
    then: Promise<TResult>['then']
    catch: Promise<TResult>['catch']
    finally: Promise<TResult>['finally']
  } = {
    from: jest.fn(() => builder),
    innerJoin: jest.fn(() => builder),
    leftJoin: jest.fn(() => builder),
    orderBy: jest.fn(() => builder),
    where: jest.fn(() => promise),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }

  return builder
}

function createSectionService() {
  const db = {
    query: {
      forumSection: {
        findFirst: jest.fn(async () => ({
          id: 10,
          groupId: 2,
          isEnabled: true,
        })),
      },
    },
    select: jest.fn(() =>
      createThenableBuilder([
        {
          avatar: 'avatar.png',
          groupId: null,
          moderatorId: 9,
          nickname: 'Alice',
          permissions: [ForumModeratorPermissionEnum.AUDIT],
          roleType: ForumModeratorRoleTypeEnum.SECTION,
          userId: 100,
        },
      ]),
    ),
  }
  const drizzle = {
    db,
    schema: {
      appUser: {
        avatarUrl: 'avatarUrl',
        id: 'appUser.id',
        nickname: 'nickname',
      },
      forumModerator: {
        deletedAt: 'deletedAt',
        groupId: 'groupId',
        id: 'id',
        isEnabled: 'isEnabled',
        permissions: 'permissions',
        roleType: 'roleType',
        userId: 'userId',
      },
      forumModeratorSection: {
        moderatorId: 'moderatorId',
        sectionId: 'sectionId',
      },
      forumSection: {
        deletedAt: 'deletedAt',
        groupId: 'section.groupId',
        id: 'section.id',
        isEnabled: 'section.isEnabled',
      },
    },
  }
  const service = new ForumSectionService(
    drizzle as any,
    { isSectionPubliclyAvailable: jest.fn(() => true) } as any,
    {} as any,
    {} as any,
    {} as any,
  )

  return { db, service }
}

describe('ForumSectionService section moderators', () => {
  it('returns enabled moderator summaries for a visible section', async () => {
    const { db, service } = createSectionService()

    await expect(service.getVisibleSectionModerators(10)).resolves.toEqual([
      {
        avatar: 'avatar.png',
        moderatorId: 9,
        nickname: 'Alice',
        permissionNames: ['审核'],
        roleType: ForumModeratorRoleTypeEnum.SECTION,
        userId: 100,
      },
    ])

    expect(db.query.forumSection.findFirst).toHaveBeenCalled()
    expect(db.select).toHaveBeenCalled()
  })
})
