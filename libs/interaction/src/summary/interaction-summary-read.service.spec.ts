/// <reference types="jest" />
import { adminUser, appUser, userComment, work } from '@db/schema'
import { AuditRoleEnum, AuditStatusEnum } from '@libs/platform/constant'
import { CommentTargetTypeEnum } from '../comment/comment.constant'
import { ReportTargetTypeEnum } from '../report/report.constant'
import { InteractionSummaryReadService } from './interaction-summary-read.service'

function createDbSelectMock(results: unknown[][]) {
  const select = jest.fn(() => {
    const result = results.shift() ?? []
    const query = {
      from: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(result),
        leftJoin: jest.fn(() => ({
          where: jest.fn().mockResolvedValue(result),
        })),
      })),
    }
    return query
  })

  return { select }
}

function createService(results: unknown[][]) {
  const db = createDbSelectMock(results)
  const service = new InteractionSummaryReadService({
    db,
    schema: {
      adminUser,
      appUser,
      userComment,
      work,
    },
  } as never)

  return { service, db }
}

describe('InteractionSummaryReadService', () => {
  it('returns an empty target summary map without querying for empty input', async () => {
    const { service, db } = createService([])

    const result = await service.getCommentTargetSummaryMap([])

    expect(result.size).toBe(0)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('deduplicates comment work targets and maps display names', async () => {
    const { service, db } = createService([
      [
        {
          id: 11,
          name: '进击的巨人',
          deletedAt: null,
        },
      ],
    ])

    const result = await service.getCommentTargetSummaryMap([
      {
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 11,
      },
      {
        targetType: CommentTargetTypeEnum.COMIC,
        targetId: 11,
      },
    ])

    expect(db.select).toHaveBeenCalledTimes(1)
    expect(
      result.get(
        service.buildTargetSummaryKey({
          targetType: CommentTargetTypeEnum.COMIC,
          targetId: 11,
        }),
      ),
    ).toEqual({
      targetId: 11,
      targetType: CommentTargetTypeEnum.COMIC,
      targetTypeName: '漫画作品',
      name: '进击的巨人',
      deletedAt: null,
    })
  })

  it('builds reply comment summaries with 50-character excerpts', async () => {
    const content =
      '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一'
    const { service } = createService([
      [
        {
          id: 9,
          userId: 3,
          content,
          auditStatus: AuditStatusEnum.APPROVED,
          isHidden: false,
        },
      ],
      [
        {
          id: 3,
          nickname: '评论用户',
          avatarUrl: 'https://example.com/avatar.png',
          status: 1,
          isEnabled: true,
        },
      ],
    ])

    const result = await service.getReplyCommentSummaryMap([9])

    expect(result.get(9)).toEqual({
      commentId: 9,
      contentExcerpt: content.slice(0, 50),
      userNickname: '评论用户',
      userAvatarUrl: 'https://example.com/avatar.png',
      userStatus: 1,
      userIsEnabled: true,
      auditStatus: AuditStatusEnum.APPROVED,
      isHidden: false,
    })
  })

  it('builds report comment target summaries with detail author fields', async () => {
    const content =
      '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十一'
    const { service } = createService([
      [
        {
          id: 9,
          userId: 3,
          content,
          auditStatus: AuditStatusEnum.APPROVED,
          isHidden: false,
          deletedAt: null,
        },
      ],
      [
        {
          id: 3,
          nickname: '评论作者',
          avatarUrl: 'https://example.com/author.png',
          status: 1,
          isEnabled: true,
        },
      ],
    ])

    const result = await service.getReportTargetSummaryMap(
      [
        {
          targetType: ReportTargetTypeEnum.COMMENT,
          targetId: 9,
        },
      ],
      { detail: true },
    )

    expect(
      result.get(
        service.buildTargetSummaryKey({
          targetType: ReportTargetTypeEnum.COMMENT,
          targetId: 9,
        }),
      ),
    ).toEqual({
      targetId: 9,
      targetType: ReportTargetTypeEnum.COMMENT,
      targetTypeName: '评论',
      contentExcerpt: content.slice(0, 50),
      authorNickname: '评论作者',
      authorAvatarUrl: 'https://example.com/author.png',
      isHidden: false,
      auditStatus: AuditStatusEnum.APPROVED,
      deletedAt: null,
    })
  })

  it('builds auditor summaries from admin and moderator sources', async () => {
    const { service } = createService([
      [
        {
          id: 1,
          username: 'admin',
          avatar: null,
          role: 1,
        },
      ],
      [
        {
          id: 2,
          nickname: '版主甲',
          avatarUrl: 'https://example.com/mod.png',
          status: 1,
          isEnabled: true,
        },
      ],
    ])

    const result = await service.getAuditorSummaryMap([
      { auditById: 1, auditRole: AuditRoleEnum.ADMIN },
      { auditById: 2, auditRole: AuditRoleEnum.MODERATOR },
    ])

    expect(result.get('admin:1')).toEqual({
      id: 1,
      username: 'admin',
      nickname: 'admin',
      avatar: undefined,
      roleName: '超级管理员',
    })
    expect(result.get('moderator:2')).toEqual({
      id: 2,
      username: '版主甲',
      nickname: '版主甲',
      avatar: 'https://example.com/mod.png',
      roleName: '版主',
    })
  })
})
