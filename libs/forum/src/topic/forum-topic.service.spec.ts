/// <reference types="jest" />

import type { Db } from '@db/core'
import type { ForumTopicSelect } from '@db/schema'
import { DrizzleService } from '@db/core'
import { GrowthRewardSettlementService } from '@libs/growth/growth-reward/growth-reward-settlement.service'
import { CommentService } from '@libs/interaction/comment/comment.service'
import { AuditStatusEnum } from '@libs/platform/constant'
import { Test } from '@nestjs/testing'
import { ForumModeratorActionLogService } from '../moderator/moderator-action-log.service'
import { ForumModeratorGovernanceService } from '../moderator/moderator-governance.service'
import { ForumModeratorService } from '../moderator/moderator.service'
import { ForumTopicCommandService } from './forum-topic-command.service'
import { ForumTopicQueryService } from './forum-topic-query.service'
import { ForumTopicService } from './forum-topic.service'

type QueryFacadeMock = Record<
  | 'getTopicById'
  | 'getPublicTopicById'
  | 'getTopicCommentTarget'
  | 'getTopics'
  | 'getPublicTopics'
  | 'getHotPublicTopics'
  | 'getFollowingPublicTopics'
  | 'batchGetFavoriteTopicDetails',
  jest.Mock
>

type CommandFacadeMock = Record<
  | 'getActiveTopicByIdInTx'
  | 'createForumTopic'
  | 'updateTopic'
  | 'deleteTopicWithCurrentInTx'
  | 'deleteTopic'
  | 'moveTopic'
  | 'moveTopicInTx'
  | 'updateTopicStatusInTx'
  | 'updateTopicPinned'
  | 'updateTopicPinnedInTx'
  | 'updateTopicFeatured'
  | 'updateTopicFeaturedInTx'
  | 'updateTopicLocked'
  | 'updateTopicLockedInTx'
  | 'updateTopicHidden'
  | 'updateTopicHiddenInTx'
  | 'updateTopicAuditStatus'
  | 'updateTopicAuditStatusInTx'
  | 'rewardApprovedTopicIfNeeded'
  | 'updateUserTopic'
  | 'deleteUserTopic',
  jest.Mock
>

// 创建 facade 依赖 mock，确保测试只验证公开 API 边界和委托关系。
async function createFacadeHarness() {
  const queryService: QueryFacadeMock = {
    getTopicById: jest.fn(async () => 'getTopicById'),
    getPublicTopicById: jest.fn(async () => 'getPublicTopicById'),
    getTopicCommentTarget: jest.fn(async () => 'getTopicCommentTarget'),
    getTopics: jest.fn(async () => 'getTopics'),
    getPublicTopics: jest.fn(async () => 'getPublicTopics'),
    getHotPublicTopics: jest.fn(async () => 'getHotPublicTopics'),
    getFollowingPublicTopics: jest.fn(async () => 'getFollowingPublicTopics'),
    batchGetFavoriteTopicDetails: jest.fn(
      async () => 'batchGetFavoriteTopicDetails',
    ),
  }
  const commandService: CommandFacadeMock = {
    getActiveTopicByIdInTx: jest.fn(async () => 'getActiveTopicByIdInTx'),
    createForumTopic: jest.fn(async () => 'createForumTopic'),
    updateTopic: jest.fn(async () => 'updateTopic'),
    deleteTopicWithCurrentInTx: jest.fn(
      async () => 'deleteTopicWithCurrentInTx',
    ),
    deleteTopic: jest.fn(async () => 'deleteTopic'),
    moveTopic: jest.fn(async () => 'moveTopic'),
    moveTopicInTx: jest.fn(async () => 'moveTopicInTx'),
    updateTopicStatusInTx: jest.fn(async () => 'updateTopicStatusInTx'),
    updateTopicPinned: jest.fn(async () => 'updateTopicPinned'),
    updateTopicPinnedInTx: jest.fn(async () => 'updateTopicPinnedInTx'),
    updateTopicFeatured: jest.fn(async () => 'updateTopicFeatured'),
    updateTopicFeaturedInTx: jest.fn(async () => 'updateTopicFeaturedInTx'),
    updateTopicLocked: jest.fn(async () => 'updateTopicLocked'),
    updateTopicLockedInTx: jest.fn(async () => 'updateTopicLockedInTx'),
    updateTopicHidden: jest.fn(async () => 'updateTopicHidden'),
    updateTopicHiddenInTx: jest.fn(async () => 'updateTopicHiddenInTx'),
    updateTopicAuditStatus: jest.fn(async () => 'updateTopicAuditStatus'),
    updateTopicAuditStatusInTx: jest.fn(
      async () => 'updateTopicAuditStatusInTx',
    ),
    rewardApprovedTopicIfNeeded: jest.fn(
      async () => 'rewardApprovedTopicIfNeeded',
    ),
    updateUserTopic: jest.fn(async () => 'updateUserTopic'),
    deleteUserTopic: jest.fn(async () => 'deleteUserTopic'),
  }

  const moduleRef = await Test.createTestingModule({
    providers: [
      ForumTopicService,
      { provide: ForumTopicQueryService, useValue: queryService },
      { provide: ForumTopicCommandService, useValue: commandService },
    ],
  }).compile()

  return {
    commandService,
    moduleRef,
    queryService,
    service: moduleRef.get(ForumTopicService),
  }
}

describe('ForumTopicService facade delegation', () => {
  it('delegates all public read APIs to ForumTopicQueryService', async () => {
    const { moduleRef, queryService, service } = await createFacadeHarness()

    try {
      await expect(service.getTopicById(1)).resolves.toBe('getTopicById')
      expect(queryService.getTopicById).toHaveBeenCalledWith(1)

      await expect(service.getPublicTopicById(2, { userId: 7 })).resolves.toBe(
        'getPublicTopicById',
      )
      expect(queryService.getPublicTopicById).toHaveBeenCalledWith(2, {
        userId: 7,
      })

      await expect(service.getTopicCommentTarget(3, 8)).resolves.toBe(
        'getTopicCommentTarget',
      )
      expect(queryService.getTopicCommentTarget).toHaveBeenCalledWith(3, 8)

      await expect(
        service.getTopics({ pageIndex: 1, pageSize: 20 }),
      ).resolves.toBe('getTopics')
      expect(queryService.getTopics).toHaveBeenCalledWith({
        pageIndex: 1,
        pageSize: 20,
      })

      await expect(
        service.getPublicTopics({ pageIndex: 1, pageSize: 20, userId: 9 }),
      ).resolves.toBe('getPublicTopics')
      expect(queryService.getPublicTopics).toHaveBeenCalledWith({
        pageIndex: 1,
        pageSize: 20,
        userId: 9,
      })

      await expect(
        service.getHotPublicTopics({ pageIndex: 1, pageSize: 20, userId: 9 }),
      ).resolves.toBe('getHotPublicTopics')
      expect(queryService.getHotPublicTopics).toHaveBeenCalledWith({
        pageIndex: 1,
        pageSize: 20,
        userId: 9,
      })

      await expect(
        service.getFollowingPublicTopics({
          pageIndex: 1,
          pageSize: 20,
          userId: 9,
        }),
      ).resolves.toBe('getFollowingPublicTopics')
      expect(queryService.getFollowingPublicTopics).toHaveBeenCalledWith({
        pageIndex: 1,
        pageSize: 20,
        userId: 9,
      })

      await expect(
        service.batchGetFavoriteTopicDetails([1, 2], 9),
      ).resolves.toBe('batchGetFavoriteTopicDetails')
      expect(queryService.batchGetFavoriteTopicDetails).toHaveBeenCalledWith(
        [1, 2],
        9,
      )
    } finally {
      await moduleRef.close()
    }
  })

  it('delegates all public write APIs to ForumTopicCommandService', async () => {
    const { commandService, moduleRef, service } = await createFacadeHarness()
    const tx = { tx: true } as unknown as Db
    const topic = { id: 1, userId: 2 } as ForumTopicSelect
    const updateTopicDto = { id: 1, html: '<p>next</p>' }

    try {
      await expect(service.getActiveTopicByIdInTx(tx, 1)).resolves.toBe(
        'getActiveTopicByIdInTx',
      )
      expect(commandService.getActiveTopicByIdInTx).toHaveBeenCalledWith(tx, 1)

      await expect(
        service.createForumTopic(
          { sectionId: 1, userId: 2, html: '<p>x</p>' },
          { ipAddress: '127.0.0.1' },
        ),
      ).resolves.toBe('createForumTopic')
      expect(commandService.createForumTopic).toHaveBeenCalledWith(
        { sectionId: 1, userId: 2, html: '<p>x</p>' },
        { ipAddress: '127.0.0.1' },
      )

      await expect(service.updateTopic(updateTopicDto, {}, 2)).resolves.toBe(
        'updateTopic',
      )
      expect(commandService.updateTopic).toHaveBeenCalledWith(
        updateTopicDto,
        {},
        2,
        {},
      )

      await expect(
        service.deleteTopicWithCurrentInTx(tx, topic, {}, 2),
      ).resolves.toBe('deleteTopicWithCurrentInTx')
      expect(commandService.deleteTopicWithCurrentInTx).toHaveBeenCalledWith(
        tx,
        topic,
        {},
        2,
        {},
      )

      await expect(service.deleteTopic(1, {}, 2)).resolves.toBe('deleteTopic')
      expect(commandService.deleteTopic).toHaveBeenCalledWith(1, {}, 2)

      await expect(service.moveTopic({ id: 1, sectionId: 3 })).resolves.toBe(
        'moveTopic',
      )
      expect(commandService.moveTopic).toHaveBeenCalledWith({
        id: 1,
        sectionId: 3,
      })

      await expect(
        service.moveTopicInTx(tx, { id: 1, sectionId: 3 }, 2),
      ).resolves.toBe('moveTopicInTx')
      expect(commandService.moveTopicInTx).toHaveBeenCalledWith(
        tx,
        { id: 1, sectionId: 3 },
        2,
      )

      await expect(
        service.updateTopicStatusInTx(
          tx,
          1,
          { isLocked: true },
          { syncSectionVisibility: true },
          3,
        ),
      ).resolves.toBe('updateTopicStatusInTx')
      expect(commandService.updateTopicStatusInTx).toHaveBeenCalledWith(
        tx,
        1,
        { isLocked: true },
        { syncSectionVisibility: true },
        3,
      )

      await expect(
        service.updateTopicPinned({ id: 1, isPinned: true }),
      ).resolves.toBe('updateTopicPinned')
      expect(commandService.updateTopicPinned).toHaveBeenCalledWith({
        id: 1,
        isPinned: true,
      })

      await expect(
        service.updateTopicPinnedInTx(tx, { id: 1, isPinned: false }),
      ).resolves.toBe('updateTopicPinnedInTx')
      expect(commandService.updateTopicPinnedInTx).toHaveBeenCalledWith(tx, {
        id: 1,
        isPinned: false,
      })

      await expect(
        service.updateTopicFeatured({ id: 1, isFeatured: true }),
      ).resolves.toBe('updateTopicFeatured')
      expect(commandService.updateTopicFeatured).toHaveBeenCalledWith({
        id: 1,
        isFeatured: true,
      })

      await expect(
        service.updateTopicFeaturedInTx(tx, { id: 1, isFeatured: false }),
      ).resolves.toBe('updateTopicFeaturedInTx')
      expect(commandService.updateTopicFeaturedInTx).toHaveBeenCalledWith(tx, {
        id: 1,
        isFeatured: false,
      })

      await expect(
        service.updateTopicLocked({ id: 1, isLocked: true }),
      ).resolves.toBe('updateTopicLocked')
      expect(commandService.updateTopicLocked).toHaveBeenCalledWith({
        id: 1,
        isLocked: true,
      })

      await expect(
        service.updateTopicLockedInTx(tx, { id: 1, isLocked: false }),
      ).resolves.toBe('updateTopicLockedInTx')
      expect(commandService.updateTopicLockedInTx).toHaveBeenCalledWith(tx, {
        id: 1,
        isLocked: false,
      })

      await expect(
        service.updateTopicHidden({ id: 1, isHidden: true }),
      ).resolves.toBe('updateTopicHidden')
      expect(commandService.updateTopicHidden).toHaveBeenCalledWith({
        id: 1,
        isHidden: true,
      })

      await expect(
        service.updateTopicHiddenInTx(tx, { id: 1, isHidden: false }),
      ).resolves.toBe('updateTopicHiddenInTx')
      expect(commandService.updateTopicHiddenInTx).toHaveBeenCalledWith(
        tx,
        { id: 1, isHidden: false },
        undefined,
      )

      await expect(
        service.updateTopicAuditStatus({
          id: 1,
          auditStatus: AuditStatusEnum.APPROVED,
          auditReason: null,
        }),
      ).resolves.toBe('updateTopicAuditStatus')
      expect(commandService.updateTopicAuditStatus).toHaveBeenCalledWith(
        { id: 1, auditStatus: AuditStatusEnum.APPROVED, auditReason: null },
        undefined,
      )

      await expect(
        service.updateTopicAuditStatusInTx(tx, {
          id: 1,
          auditStatus: AuditStatusEnum.REJECTED,
          auditReason: '内容违规',
        }),
      ).resolves.toBe('updateTopicAuditStatusInTx')
      expect(commandService.updateTopicAuditStatusInTx).toHaveBeenCalledWith(
        tx,
        {
          id: 1,
          auditStatus: AuditStatusEnum.REJECTED,
          auditReason: '内容违规',
        },
        undefined,
        undefined,
      )

      await expect(
        service.rewardApprovedTopicIfNeeded({
          topicId: 1,
          userId: 2,
          previousAuditStatus: AuditStatusEnum.PENDING,
          nextAuditStatus: AuditStatusEnum.APPROVED,
        }),
      ).resolves.toBe('rewardApprovedTopicIfNeeded')
      expect(commandService.rewardApprovedTopicIfNeeded).toHaveBeenCalledWith({
        topicId: 1,
        userId: 2,
        previousAuditStatus: AuditStatusEnum.PENDING,
        nextAuditStatus: AuditStatusEnum.APPROVED,
      })

      await expect(
        service.updateUserTopic(2, updateTopicDto, {}),
      ).resolves.toBe('updateUserTopic')
      expect(commandService.updateUserTopic).toHaveBeenCalledWith(
        2,
        updateTopicDto,
        {},
      )

      await expect(service.deleteUserTopic(2, 1, {})).resolves.toBe(
        'deleteUserTopic',
      )
      expect(commandService.deleteUserTopic).toHaveBeenCalledWith(2, 1, {})
    } finally {
      await moduleRef.close()
    }
  })
})

describe('ForumTopicService DI smoke', () => {
  it('compiles the facade with query and command providers', async () => {
    const { moduleRef } = await createFacadeHarness()

    expect(moduleRef.get(ForumTopicService)).toBeInstanceOf(ForumTopicService)
    await moduleRef.close()
  })

  it('compiles the moderator consumer path against ForumTopicService', async () => {
    const { moduleRef: facadeModuleRef, service } = await createFacadeHarness()
    const moduleRef = await Test.createTestingModule({
      providers: [
        ForumModeratorGovernanceService,
        { provide: DrizzleService, useValue: {} },
        { provide: ForumModeratorService, useValue: {} },
        { provide: ForumTopicService, useValue: service },
        { provide: CommentService, useValue: {} },
        { provide: ForumModeratorActionLogService, useValue: {} },
        { provide: GrowthRewardSettlementService, useValue: {} },
      ],
    }).compile()

    expect(moduleRef.get(ForumModeratorGovernanceService)).toBeInstanceOf(
      ForumModeratorGovernanceService,
    )
    await moduleRef.close()
    await facadeModuleRef.close()
  })
})
