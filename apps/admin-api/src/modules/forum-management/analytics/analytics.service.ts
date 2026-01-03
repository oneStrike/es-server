import { Injectable } from '@nestjs/common'
import { RepositoryService } from '@libs/prisma'
import {
  ForumOverviewDto,
  ActivityTrendQueryDto,
  HotTopicsQueryDto,
  ActiveUsersQueryDto,
  SectionStatsQueryDto,
  ActivityTrendPointDto,
  HotTopicDto,
  ActiveUserDto,
  SectionStatsDto,
} from './dto/analytics.dto'
import { TimeRangeEnum } from './analytics.constant'

@Injectable()
export class AnalyticsService extends RepositoryService {
  get forumUser() {
    return this.prisma.forumUser
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
    return this.prisma.forumSectionModerator
  }

  get forumLike() {
    return this.prisma.forumLike
  }

  get forumView() {
    return this.prisma.forumView
  }

  private getDateRange(timeRange: TimeRangeEnum): { startDate: Date; endDate: Date } {
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
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
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
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
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
      this.forumUser.count({ where: { deletedAt: null } }),
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
      this.forumUser.count({
        where: {
          deletedAt: null,
          createdAt: { gte: todayStart },
        },
      }),
      this.forumUser.count({
        where: {
          deletedAt: null,
          lastActiveAt: { gte: sevenDaysAgo },
        },
      }),
      this.forumUser.count({
        where: {
          deletedAt: null,
          lastActiveAt: { gte: fiveMinutesAgo },
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

  async getActivityTrend(query: ActivityTrendQueryDto): Promise<ActivityTrendPointDto[]> {
    let startDate: Date
    let endDate: Date

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate)
      endDate = new Date(query.endDate)
    } else {
      const range = this.getDateRange(query.timeRange || TimeRangeEnum.LAST_7_DAYS)
      startDate = range.startDate
      endDate = range.endDate
    }

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const trends: ActivityTrendPointDto[] = []

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate)
      dayStart.setDate(dayStart.getDate() + i)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const [topicCount, replyCount, userCount, visitCount] = await Promise.all([
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
        this.forumUser.count({
          where: {
            deletedAt: null,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        this.forumView.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
      ])

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        topicCount,
        replyCount,
        userCount,
        visitCount,
      })
    }

    return trends
  }

  async getHotTopics(query: HotTopicsQueryDto): Promise<{ total: number; items: HotTopicDto[] }> {
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
      authorId: topic.authorId,
      authorNickname: topic.author.nickname,
      viewCount: topic.viewCount,
      replyCount: topic._count.replies,
      likeCount: topic._count.likes,
      createdAt: topic.createdAt.toISOString(),
    }))

    return { total, items }
  }

  async getActiveUsers(query: ActiveUsersQueryDto): Promise<{ total: number; items: ActiveUserDto[] }> {
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

    const [total, users] = await Promise.all([
      this.forumUser.count({ where: { deletedAt: null } }),
      this.forumUser.findMany({
        where: { deletedAt: null },
        orderBy: {
          [sortBy]: 'desc',
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          nickname: true,
          avatar: true,
          points: true,
          level: true,
          topicCount: true,
          replyCount: true,
          lastActiveAt: true,
        },
      }),
    ])

    const items: ActiveUserDto[] = users.map((user) => ({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar || undefined,
      points: user.points,
      level: user.level,
      topicCount: user.topicCount,
      replyCount: user.replyCount,
      lastActiveAt: user.lastActiveAt.toISOString(),
    }))

    return { total, items }
  }

  async getSectionStats(query: SectionStatsQueryDto): Promise<{ total: number; items: SectionStatsDto[] }> {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

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
      const todayActiveUsers = await this.forumUser.count({
        where: {
          deletedAt: null,
          lastActiveAt: { gte: todayStart },
          topics: {
            some: { sectionId: section.id },
          },
        },
      })

      items.push({
        id: section.id,
        name: section.name,
        topicCount: section._count.topics,
        replyCount: section._count.replies,
        userCount: 0,
        todayTopics: section.topics.length,
        todayReplies: section.replies.length,
        todayActiveUsers,
      })
    }

    return { total, items }
  }
}
