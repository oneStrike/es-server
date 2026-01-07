import { RepositoryService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { TimeRangeEnum } from './analytics.constant'
import {
  ActiveUserDto,
  ActiveUsersQueryDto,
  ActivityTrendPointDto,
  ActivityTrendQueryDto,
  ForumOverviewDto,
  HotTopicDto,
  HotTopicsQueryDto,
  SectionStatsDto,
  SectionStatsQueryDto,
} from './dto/analytics.dto'

@Injectable()
export class AnalyticsService extends RepositoryService {
  get forumProfile() {
    return this.prisma.forumProfile
  }

  get forumTopic() {
    return this.prisma.forumTopic
  }

  get forumReply() {
    return this.prisma.forumReply
  }

  get forumSection() {
    return this.prisma.forumSection
  }

  get forumSectionModerator() {
    return this.prisma.forumModeratorSection
  }

  get clientUser() {
    return this.prisma.clientUser
  }

  private getDateRange(timeRange: TimeRangeEnum): {
    startDate: Date
    endDate: Date
  } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    switch (timeRange) {
      case TimeRangeEnum.TODAY:
        return { startDate: today, endDate: now }
      case TimeRangeEnum.YESTERDAY:
        return { startDate: yesterday, endDate: today }
      case TimeRangeEnum.LAST_7_DAYS:
        const last7Days = new Date(today)
        last7Days.setDate(last7Days.getDate() - 7)
        return { startDate: last7Days, endDate: now }
      case TimeRangeEnum.LAST_30_DAYS:
        const last30Days = new Date(today)
        last30Days.setDate(last30Days.getDate() - 30)
        return { startDate: last30Days, endDate: now }
      case TimeRangeEnum.LAST_90_DAYS:
        const last90Days = new Date(today)
        last90Days.setDate(last90Days.getDate() - 90)
        return { startDate: last90Days, endDate: now }
      case TimeRangeEnum.THIS_MONTH:
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        return { startDate: thisMonthStart, endDate: now }
      case TimeRangeEnum.LAST_MONTH:
        const lastMonthStart = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          1,
        )
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1)
        return { startDate: lastMonthStart, endDate: lastMonthEnd }
      case TimeRangeEnum.THIS_YEAR:
        const thisYearStart = new Date(now.getFullYear(), 0, 1)
        return { startDate: thisYearStart, endDate: now }
      default:
        return { startDate: today, endDate: now }
    }
  }

  async getForumOverview(): Promise<ForumOverviewDto> {
    const today = new Date()
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    )
    const sevenDaysAgo = new Date(todayStart)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const fiveMinutesAgo = new Date(today.getTime() - 5 * 60 * 1000)

    const [
      totalUsers,
      totalTopics,
      totalReplies,
      totalSections,
      todayTopics,
      todayReplies,
      todayUsers,
      activeUsers,
      onlineUsers,
    ] = await Promise.all([
      this.forumProfile.count({ where: { deletedAt: null } }),
      this.forumTopic.count({ where: { deletedAt: null } }),
      this.forumReply.count({ where: { deletedAt: null } }),
      this.forumSection.count({ where: { deletedAt: null } }),
      this.forumTopic.count({
        where: {
          deletedAt: null,
          createdAt: { gte: todayStart },
        },
      }),
      this.forumReply.count({
        where: {
          deletedAt: null,
          createdAt: { gte: todayStart },
        },
      }),
      this.forumProfile.count({
        where: {
          deletedAt: null,
          createdAt: { gte: todayStart },
        },
      }),
      this.clientUser.count({
        where: {
          deletedAt: null,
          lastLoginAt: { gte: sevenDaysAgo },
        },
      }),
      this.clientUser.count({
        where: {
          deletedAt: null,
          lastLoginAt: { gte: fiveMinutesAgo },
        },
      }),
    ])

    return {
      totalUsers,
      totalTopics,
      totalReplies,
      totalSections,
      todayTopics,
      todayReplies,
      todayUsers,
      activeUsers,
      onlineUsers,
    }
  }

  async getActivityTrend(
    query: ActivityTrendQueryDto,
  ): Promise<ActivityTrendPointDto[]> {
    let startDate: Date
    let endDate: Date

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate)
      endDate = new Date(query.endDate)
    } else {
      const range = this.getDateRange(
        query.timeRange || TimeRangeEnum.LAST_7_DAYS,
      )
      startDate = range.startDate
      endDate = range.endDate
    }

    const days = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    const trends: ActivityTrendPointDto[] = []

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate)
      dayStart.setDate(dayStart.getDate() + i)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const [topicCount, replyCount, userCount] = await Promise.all([
        this.forumTopic.count({
          where: {
            deletedAt: null,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        this.forumReply.count({
          where: {
            deletedAt: null,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        this.forumProfile.count({
          where: {
            deletedAt: null,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
      ])

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        topicCount,
        replyCount,
        userCount,
        visitCount: 0,
      })
    }

    return trends
  }

  async getHotTopics(
    query: HotTopicsQueryDto,
  ): Promise<{ total: number; items: HotTopicDto[] }> {
    let startDate: Date
    let endDate: Date

    if (query.timeRange) {
      const range = this.getDateRange(query.timeRange)
      startDate = range.startDate
      endDate = range.endDate
    } else {
      startDate = new Date(0)
      endDate = new Date()
    }

    const where: any = {
      deletedAt: null,
      createdAt: { gte: startDate, lte: endDate },
    }

    if (query.sectionId) {
      where.sectionId = query.sectionId
    }

    const sortBy = query.sortBy || 'viewCount'

    const [total, topics] = await Promise.all([
      this.forumTopic.count({ where }),
      this.forumTopic.findMany({
        where,
        include: {
          section: {
            select: { id: true, name: true },
          },
          author: {
            select: { id: true, nickname: true },
          },
          _count: {
            select: { replies: true, likes: true },
          },
        },
        orderBy: {
          [sortBy]: 'desc',
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ])

    const items: HotTopicDto[] = topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      sectionId: topic.sectionId,
      sectionName: topic.section.name,
      authorId: topic.userId,
      authorNickname: topic.user.nickname,
      viewCount: topic.viewCount,
      replyCount: topic._count.replies,
      likeCount: topic._count.likes,
      createdAt: topic.createdAt.toISOString(),
    }))

    return { total, items }
  }

  async getActiveUsers(
    query: ActiveUsersQueryDto,
  ): Promise<{ total: number; items: ActiveUserDto[] }> {
    let startDate: Date
    let endDate: Date

    if (query.timeRange) {
      const range = this.getDateRange(query.timeRange)
      startDate = range.startDate
      endDate = range.endDate
    } else {
      startDate = new Date(0)
      endDate = new Date()
    }

    const sortBy = query.sortBy || 'points'

    const [total, profiles] = await Promise.all([
      this.forumProfile.count({ where: { deletedAt: null } }),
      this.forumProfile.findMany({
        where: { deletedAt: null },
        orderBy: {
          [sortBy]: 'desc',
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatar: true,
              lastLoginAt: true,
            },
          },
          level: {
            select: {
              id: true,
              name: true,
              level: true,
            },
          },
        },
      }),
    ])

    const items: ActiveUserDto[] = profiles.map((profile) => ({
      id: profile.user.id,
      nickname: profile.user.nickname,
      avatar: profile.user.avatar || undefined,
      points: profile.points,
      level: profile.level.level,
      topicCount: profile.topicCount,
      replyCount: profile.replyCount,
      lastActiveAt: profile.user.lastLoginAt?.toISOString(),
    }))

    return { total, items }
  }

  async getSectionStats(
    query: SectionStatsQueryDto,
  ): Promise<{ total: number; items: SectionStatsDto[] }> {
    const today = new Date()
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    )

    const where: any = {
      deletedAt: null,
    }

    if (query.sectionId) {
      where.id = query.sectionId
    }

    const sortBy = query.sortBy || 'topicCount'

    const sections = await this.forumSection.findMany({
      where,
      include: {
        _count: {
          select: {
            topics: true,
            replies: true,
          },
        },
        topics: {
          where: {
            createdAt: { gte: todayStart },
          },
          select: { id: true },
        },
        replies: {
          where: {
            createdAt: { gte: todayStart },
          },
          select: { id: true },
        },
      },
      orderBy: {
        [sortBy]: 'desc',
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    })

    const total = await this.forumSection.count({ where })

    const items: SectionStatsDto[] = []

    for (const section of sections) {
      const todayActiveUsers = await this.forumTopic.findMany({
        where: {
          sectionId: section.id,
          createdAt: { gte: todayStart },
          deletedAt: null,
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
      })

      items.push({
        id: section.id,
        name: section.name,
        topicCount: section._count.topics,
        replyCount: section._count.replies,
        userCount: 0,
        todayTopics: section.topics.length,
        todayReplies: section.replies.length,
        todayActiveUsers: todayActiveUsers.length,
      })
    }

    return { total, items }
  }
}
