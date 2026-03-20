import type { Db } from '../../db-client'
import { and, eq, isNull } from 'drizzle-orm'
import {
  appUser,
  forumModerator,
  forumModeratorActionLog,
  forumModeratorApplication,
  forumModeratorSection,
  forumSection,
  forumSectionGroup,
  forumTag,
  forumTopic,
  forumTopicTag,
  forumUserActionLog,
  userLevelRule,
  work,
} from '../../../schema'
import { SEED_ACCOUNTS, SEED_TIMELINE } from '../../shared'

const BASIC_LEVEL_NAME = '新手读者'

const SECTION_GROUP_FIXTURES = [
  {
    name: '官方社区',
    description: '站内公告、反馈与新手引导板块。',
    sortOrder: 1,
    maxModerators: 3,
  },
  {
    name: '作品讨论',
    description: '每部作品的专属讨论区，和作品表一一对应。',
    sortOrder: 2,
    maxModerators: 10,
  },
  {
    name: '创作交流',
    description: '围绕内容创作、角色塑造与设定讨论的公共板块。',
    sortOrder: 3,
    maxModerators: 5,
  },
] as const

const SECTION_FIXTURES = [
  {
    name: '新手报到',
    groupName: '官方社区',
    description: '第一次来到社区的用户可以在这里介绍自己。',
    sortOrder: 1,
    topicReviewPolicy: 1,
  },
  {
    name: '反馈建议',
    groupName: '官方社区',
    description: '功能建议、体验问题和版本反馈统一收敛到这里。',
    sortOrder: 2,
    topicReviewPolicy: 1,
  },
  {
    name: '创作讨论',
    groupName: '创作交流',
    description: '讨论叙事结构、角色塑造和创作方法。',
    sortOrder: 1,
    topicReviewPolicy: 1,
  },
] as const

const TAG_FIXTURES = [
  {
    name: '剧情讨论',
    description: '围绕情节推进、伏笔与节奏的讨论标签。',
    sortOrder: 1,
  },
  {
    name: '设定考据',
    description: '适合梳理世界观、时间线与设定细节。',
    sortOrder: 2,
  },
  {
    name: '推荐安利',
    description: '适合整理推荐理由、入坑指南与阅读顺序。',
    sortOrder: 3,
  },
  {
    name: '新人报到',
    description: '社区介绍与新用户欢迎话题标签。',
    sortOrder: 4,
  },
] as const

const TOPIC_FIXTURES = [
  {
    sectionName: '进击的巨人',
    userAccount: SEED_ACCOUNTS.readerA,
    title: '进击的巨人：前三卷伏笔整理',
    content: '把前三卷埋下的关键线索重新梳理了一遍，欢迎补充遗漏细节。',
    isPinned: true,
    isFeatured: true,
    tagNames: ['剧情讨论', '设定考据'],
    createdAt: new Date('2026-03-19T10:00:00.000Z'),
  },
  {
    sectionName: '白夜行',
    userAccount: SEED_ACCOUNTS.readerB,
    title: '白夜行：你更在意悬疑线还是人物线？',
    content:
      '这部作品我二刷之后更能感受到人物关系带来的压迫感，想看看大家的阅读重点。',
    isPinned: false,
    isFeatured: true,
    tagNames: ['剧情讨论', '推荐安利'],
    createdAt: new Date('2026-03-19T12:30:00.000Z'),
  },
  {
    sectionName: '新手报到',
    userAccount: SEED_ACCOUNTS.readerC,
    title: '新手报到：我的第一份追更清单',
    content: '刚进社区，先把最近想补的漫画和小说列出来，后面慢慢追更。',
    isPinned: false,
    isFeatured: false,
    tagNames: ['新人报到'],
    createdAt: new Date('2026-03-19T15:00:00.000Z'),
  },
] as const

export async function seedForumReferenceDomain(db: Db) {
  console.log('🌱 初始化论坛参考数据...')

  for (const groupFixture of SECTION_GROUP_FIXTURES) {
    const existing = await db.query.forumSectionGroup.findFirst({
      where: and(
        eq(forumSectionGroup.name, groupFixture.name),
        isNull(forumSectionGroup.deletedAt),
      ),
    })

    if (!existing) {
      await db.insert(forumSectionGroup).values({
        ...groupFixture,
        isEnabled: true,
      })
    } else {
      await db
        .update(forumSectionGroup)
        .set({
          ...groupFixture,
          isEnabled: true,
        })
        .where(eq(forumSectionGroup.id, existing.id))
    }
  }
  console.log('  ✓ 板块分组完成')

  const basicLevel = await db.query.userLevelRule.findFirst({
    where: eq(userLevelRule.name, BASIC_LEVEL_NAME),
  })

  for (const sectionFixture of SECTION_FIXTURES) {
    const group = await db.query.forumSectionGroup.findFirst({
      where: and(
        eq(forumSectionGroup.name, sectionFixture.groupName),
        isNull(forumSectionGroup.deletedAt),
      ),
    })

    const existing = await db.query.forumSection.findFirst({
      where: and(
        eq(forumSection.name, sectionFixture.name),
        isNull(forumSection.deletedAt),
      ),
    })

    const payload = {
      groupId: group?.id ?? null,
      userLevelRuleId: basicLevel?.id ?? null,
      name: sectionFixture.name,
      description: sectionFixture.description,
      sortOrder: sectionFixture.sortOrder,
      isEnabled: true,
      topicReviewPolicy: sectionFixture.topicReviewPolicy,
      remark: 'seed: 论坛公共板块',
      topicCount: existing?.topicCount ?? 0,
      replyCount: existing?.replyCount ?? 0,
      lastPostAt: existing?.lastPostAt ?? null,
      lastTopicId: existing?.lastTopicId ?? null,
    }

    if (!existing) {
      await db.insert(forumSection).values(payload)
    } else {
      await db
        .update(forumSection)
        .set(payload)
        .where(eq(forumSection.id, existing.id))
    }
  }
  console.log('  ✓ 公共板块完成')

  for (const tagFixture of TAG_FIXTURES) {
    const existing = await db.query.forumTag.findFirst({
      where: eq(forumTag.name, tagFixture.name),
    })

    if (!existing) {
      await db.insert(forumTag).values({
        ...tagFixture,
        isEnabled: true,
        useCount: 0,
      })
    } else {
      await db
        .update(forumTag)
        .set({
          ...tagFixture,
          isEnabled: true,
          useCount: existing.useCount ?? 0,
        })
        .where(eq(forumTag.id, existing.id))
    }
  }
  console.log('  ✓ 论坛标签完成')

  console.log('✅ 论坛参考数据完成')
}

export async function seedForumActivityDomain(db: Db) {
  console.log('🌱 初始化论坛业务数据...')
  const touchedSectionIds = new Set<number>()

  const moderatorUser = await db.query.appUser.findFirst({
    where: eq(appUser.account, SEED_ACCOUNTS.readerC),
  })
  const applicantUser = await db.query.appUser.findFirst({
    where: eq(appUser.account, SEED_ACCOUNTS.readerA),
  })

  if (!moderatorUser || !applicantUser) {
    console.log('  ℹ 缺少 seed 用户，跳过论坛业务数据')
    return
  }

  let moderator = await db.query.forumModerator.findFirst({
    where: eq(forumModerator.userId, moderatorUser.id),
  })

  const discussionSection = await db.query.forumSection.findFirst({
    where: and(
      eq(forumSection.name, '创作讨论'),
      isNull(forumSection.deletedAt),
    ),
  })
  const aotWork = await db.query.work.findFirst({
    where: eq(work.name, '进击的巨人'),
  })

  const moderatorPayload = {
    userId: moderatorUser.id,
    groupId: discussionSection?.groupId ?? null,
    roleType: 1,
    permissions: [1, 2, 3, 4, 5],
    isEnabled: true,
    remark: 'seed: 社区版主',
  }

  if (!moderator) {
    ;[moderator] = await db
      .insert(forumModerator)
      .values(moderatorPayload)
      .returning()
  } else {
    ;[moderator] = await db
      .update(forumModerator)
      .set(moderatorPayload)
      .where(eq(forumModerator.id, moderator.id))
      .returning()
  }
  console.log('  ✓ 版主完成')

  for (const sectionId of [
    discussionSection?.id,
    aotWork?.forumSectionId,
  ].filter((value): value is number => Boolean(value))) {
    const existingRelation = await db.query.forumModeratorSection.findFirst({
      where: and(
        eq(forumModeratorSection.moderatorId, moderator.id),
        eq(forumModeratorSection.sectionId, sectionId),
      ),
    })

    if (!existingRelation) {
      await db.insert(forumModeratorSection).values({
        moderatorId: moderator.id,
        sectionId,
        permissions: [1, 2, 3, 5],
      })
    } else {
      await db
        .update(forumModeratorSection)
        .set({
          permissions: [1, 2, 3, 5],
        })
        .where(eq(forumModeratorSection.id, existingRelation.id))
    }
  }
  console.log('  ✓ 版主管辖板块完成')

  if (discussionSection) {
    const existingApplication =
      await db.query.forumModeratorApplication.findFirst({
        where: and(
          eq(forumModeratorApplication.applicantId, applicantUser.id),
          eq(forumModeratorApplication.sectionId, discussionSection.id),
        ),
      })

    const applicationPayload = {
      applicantId: applicantUser.id,
      sectionId: discussionSection.id,
      auditById: moderatorUser.id,
      status: 2,
      permissions: [1, 2, 5],
      reason: '长期参与内容讨论，希望协助维护板块秩序。',
      auditReason: '历史发言质量稳定，允许试运行。',
      remark: 'seed: 版主申请记录',
      auditAt: SEED_TIMELINE.previousDay,
    }

    if (!existingApplication) {
      await db.insert(forumModeratorApplication).values(applicationPayload)
    } else {
      await db
        .update(forumModeratorApplication)
        .set(applicationPayload)
        .where(eq(forumModeratorApplication.id, existingApplication.id))
    }
  }
  console.log('  ✓ 版主申请完成')

  for (const topicFixture of TOPIC_FIXTURES) {
    const section = await db.query.forumSection.findFirst({
      where: and(
        eq(forumSection.name, topicFixture.sectionName),
        isNull(forumSection.deletedAt),
      ),
    })
    const user = await db.query.appUser.findFirst({
      where: eq(appUser.account, topicFixture.userAccount),
    })

    if (!section || !user) {
      continue
    }
    touchedSectionIds.add(section.id)

    const existingTopic = await db.query.forumTopic.findFirst({
      where: and(
        eq(forumTopic.title, topicFixture.title),
        isNull(forumTopic.deletedAt),
      ),
    })

    let currentTopic = existingTopic
    const topicPayload = {
      sectionId: section.id,
      userId: user.id,
      lastReplyUserId: existingTopic?.lastReplyUserId ?? null,
      auditById: moderatorUser.id,
      title: topicFixture.title,
      content: topicFixture.content,
      isPinned: topicFixture.isPinned,
      isFeatured: topicFixture.isFeatured,
      isLocked: false,
      isHidden: false,
      auditStatus: 2,
      auditRole: 2,
      auditReason: 'seed: 自动通过',
      auditAt: topicFixture.createdAt,
      viewCount: existingTopic?.viewCount ?? 0,
      replyCount: existingTopic?.replyCount ?? 0,
      likeCount: existingTopic?.likeCount ?? 0,
      commentCount: existingTopic?.commentCount ?? 0,
      favoriteCount: existingTopic?.favoriteCount ?? 0,
      lastReplyAt: existingTopic?.lastReplyAt ?? topicFixture.createdAt,
      createdAt: topicFixture.createdAt,
    }

    if (!currentTopic) {
      ;[currentTopic] = await db
        .insert(forumTopic)
        .values(topicPayload)
        .returning()
    } else {
      ;[currentTopic] = await db
        .update(forumTopic)
        .set(topicPayload)
        .where(eq(forumTopic.id, currentTopic.id))
        .returning()
    }

    for (const tagName of topicFixture.tagNames) {
      const tag = await db.query.forumTag.findFirst({
        where: eq(forumTag.name, tagName),
      })
      if (!tag) {
        continue
      }

      const existingTopicTag = await db.query.forumTopicTag.findFirst({
        where: and(
          eq(forumTopicTag.topicId, currentTopic.id),
          eq(forumTopicTag.tagId, tag.id),
        ),
      })

      if (!existingTopicTag) {
        await db.insert(forumTopicTag).values({
          topicId: currentTopic.id,
          tagId: tag.id,
        })
      }
    }

    const existingActionLog = await db.query.forumUserActionLog.findFirst({
      where: and(
        eq(forumUserActionLog.userId, user.id),
        eq(forumUserActionLog.targetId, currentTopic.id),
        eq(forumUserActionLog.actionType, 1),
      ),
    })

    if (!existingActionLog) {
      await db.insert(forumUserActionLog).values({
        userId: user.id,
        targetId: currentTopic.id,
        actionType: 1,
        targetType: 1,
        afterData: JSON.stringify({ title: currentTopic.title }),
        ipAddress: '127.0.0.1',
        userAgent: 'seed-script/forum',
        createdAt: topicFixture.createdAt,
      })
    }
  }
  console.log('  ✓ 论坛主题完成')

  const pinnedTopic = await db.query.forumTopic.findFirst({
    where: and(
      eq(forumTopic.title, '进击的巨人：前三卷伏笔整理'),
      isNull(forumTopic.deletedAt),
    ),
  })

  if (pinnedTopic) {
    const existingModeratorLog =
      await db.query.forumModeratorActionLog.findFirst({
        where: and(
          eq(forumModeratorActionLog.moderatorId, moderator.id),
          eq(forumModeratorActionLog.targetId, pinnedTopic.id),
          eq(forumModeratorActionLog.actionType, 1),
        ),
      })

    if (!existingModeratorLog) {
      await db.insert(forumModeratorActionLog).values({
        moderatorId: moderator.id,
        targetId: pinnedTopic.id,
        actionType: 1,
        targetType: 1,
        actionDescription: 'seed: 将主题设为置顶',
        beforeData: JSON.stringify({ isPinned: false }),
        afterData: JSON.stringify({ isPinned: true }),
      })
    }
  }
  console.log('  ✓ 版主操作日志完成')

  const tags = await db.query.forumTag.findMany()
  for (const tag of tags) {
    const relations = await db.query.forumTopicTag.findMany({
      where: eq(forumTopicTag.tagId, tag.id),
    })

    await db
      .update(forumTag)
      .set({
        useCount: relations.length,
      })
      .where(eq(forumTag.id, tag.id))
  }
  console.log('  ✓ 标签统计完成')

  for (const sectionId of touchedSectionIds) {
    const currentSection = await db.query.forumSection.findFirst({
      where: eq(forumSection.id, sectionId),
    })
    if (!currentSection) {
      continue
    }

    const sectionTopics = await db.query.forumTopic.findMany({
      where: and(
        eq(forumTopic.sectionId, sectionId),
        isNull(forumTopic.deletedAt),
      ),
    })
    const lastTopic = [...sectionTopics]
      .sort((a, b) => {
        const left = a.lastReplyAt ?? a.createdAt
        const right = b.lastReplyAt ?? b.createdAt
        return (left?.getTime?.() ?? 0) - (right?.getTime?.() ?? 0)
      })
      .at(-1)

    await db
      .update(forumSection)
      .set({
        topicCount: sectionTopics.length,
        replyCount: sectionTopics.reduce(
          (sum, item) => sum + item.replyCount,
          0,
        ),
        lastTopicId: lastTopic?.id ?? null,
        lastPostAt:
          lastTopic?.lastReplyAt ??
          lastTopic?.createdAt ??
          currentSection.lastPostAt,
      })
      .where(eq(forumSection.id, sectionId))
  }
  console.log('  ✓ 板块统计完成')

  console.log('✅ 论坛业务数据完成')
}
