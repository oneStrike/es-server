import type { Db } from '@db/core'
import type {
  AppUpdateReleaseInsert,
  AppUpdateReleaseSelect,
  AppUpdateStoreLinkInsert,
  AppUpdateStoreLinkSelect,
} from '@db/schema'
import { buildILikeCondition, DrizzleService } from '@db/core'
import { BusinessErrorCode } from '@libs/platform/constant'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto/base.dto'
import { BusinessException } from '@libs/platform/exceptions'
import { HTTP_URL_REGEXP } from '@libs/platform/utils/regExp'
import { Injectable } from '@nestjs/common'
import type { SQL } from 'drizzle-orm'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type {
  AppUpdateReleaseDetailDto,
  AppUpdateReleaseListItemDto,
  AppUpdateStoreLinkInputDto,
  AppUpdateStoreLinkSnapshotDto,
} from './dto/update.dto'
import {
  AppUpdateCheckDto,
  AppUpdateReleaseWriteDto,
  CreateAppUpdateReleaseDto,
  QueryAppUpdateReleaseDto,
  UpdateAppUpdateReleaseDto,
} from './dto/update.dto'
import {
  DEFAULT_APP_UPDATE_CHANNEL_CODE,
  AppUpdatePackageSourceEnum,
  AppUpdateTypeEnum,
} from './update.constant'

type ReleaseWithStoreLinks = AppUpdateReleaseSelect & {
  storeLinks?: AppUpdateStoreLinkSelect[]
}

/**
 * App 更新服务。
 * 负责草稿写入、发布切换、后台查询与客户端更新检查。
 */
@Injectable()
export class AppUpdateService {
  constructor(private readonly drizzle: DrizzleService) {}

  /** 数据库连接实例。 */
  private get db() {
    return this.drizzle.db
  }

  /** 更新发布表。 */
  private get appUpdateRelease() {
    return this.drizzle.schema.appUpdateRelease
  }

  /** 商店地址表。 */
  private get appUpdateStoreLink() {
    return this.drizzle.schema.appUpdateStoreLink
  }

  /**
   * 分页查询版本发布列表。
   * 列表接口只返回后台概览字段，并补齐分发目标摘要。
   */
  async findPage(queryDto: QueryAppUpdateReleaseDto) {
    const conditions: SQL[] = []

    if (queryDto.platform) {
      conditions.push(eq(this.appUpdateRelease.platform, queryDto.platform))
    }
    if (queryDto.versionName) {
      conditions.push(
        buildILikeCondition(
          this.appUpdateRelease.versionName,
          queryDto.versionName,
        )!,
      )
    }
    if (queryDto.buildCode !== undefined) {
      conditions.push(eq(this.appUpdateRelease.buildCode, queryDto.buildCode))
    }
    if (queryDto.forceUpdate !== undefined) {
      conditions.push(
        eq(this.appUpdateRelease.forceUpdate, queryDto.forceUpdate),
      )
    }
    if (queryDto.isPublished !== undefined) {
      conditions.push(
        eq(this.appUpdateRelease.isPublished, queryDto.isPublished),
      )
    }

    const result = await this.drizzle.ext.findPagination(this.appUpdateRelease, {
      where: conditions.length > 0 ? and(...conditions) : undefined,
      ...queryDto,
      orderBy: queryDto.orderBy?.trim()
        ? queryDto.orderBy
        : { buildCode: 'desc' as const },
    })

    const ids = result.list.map(item => item.id)
    const storeLinkCountMap = await this.findStoreLinkCountMap(ids)

    return {
      ...result,
      list: result.list.map<AppUpdateReleaseListItemDto>(item => ({
        id: item.id,
        platform: item.platform as AppUpdateReleaseListItemDto['platform'],
        versionName: item.versionName,
        buildCode: item.buildCode,
        forceUpdate: item.forceUpdate,
        isPublished: item.isPublished,
        publishedAt: item.publishedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        hasPackageUrl: Boolean(item.packageUrl),
        hasCustomDownloadUrl: Boolean(item.customDownloadUrl),
        storeLinkCount: storeLinkCountMap.get(item.id) ?? 0,
      })),
    }
  }

  /**
   * 查询版本发布详情。
   * 详情接口补齐商店地址列表，供后台编辑表单直接回填。
   */
  async findDetail(dto: IdDto): Promise<AppUpdateReleaseDetailDto> {
    const release = await this.findReleaseById(dto.id, { withStoreLinks: true })
    if (!release) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '更新版本不存在',
      )
    }

    return this.toReleaseDetailDto(release)
  }

  /**
   * 创建更新草稿。
   * 写入前会规范化地址与渠道编码，并校验同平台构建号唯一约束。
   */
  async create(dto: CreateAppUpdateReleaseDto, userId: number) {
    const normalized = this.normalizeWriteDto(dto)

    await this.drizzle.withErrorHandling(
      () =>
        this.drizzle.withTransaction(async tx => {
          const [createdRelease] = await tx
            .insert(this.appUpdateRelease)
            .values({
              ...normalized.release,
              createdById: userId,
              updatedById: userId,
            })
            .returning({
              id: this.appUpdateRelease.id,
            })

          await this.replaceStoreLinks(
            tx,
            createdRelease.id,
            normalized.storeLinks,
          )
        }),
      { duplicate: '同平台构建号已存在' },
    )

    return true
  }

  /**
   * 更新更新草稿。
   * 已发布版本禁止原地编辑，避免线上版本被静默篡改。
   */
  async update(dto: UpdateAppUpdateReleaseDto, userId: number) {
    const existingRelease = await this.findReleaseById(dto.id)
    if (!existingRelease) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '更新版本不存在',
      )
    }
    if (existingRelease.isPublished) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '已发布版本不允许直接修改，请基于草稿继续维护',
      )
    }

    const { id, ...writeDto } = dto
    const normalized = this.normalizeWriteDto(writeDto)

    await this.drizzle.withErrorHandling(
      () =>
        this.drizzle.withTransaction(async tx => {
          const result = await tx
            .update(this.appUpdateRelease)
            .set({
              ...normalized.release,
              updatedById: userId,
            })
            .where(eq(this.appUpdateRelease.id, id))

          this.drizzle.assertAffectedRows(result, '更新版本不存在')
          await this.replaceStoreLinks(tx, id, normalized.storeLinks)
        }),
      { duplicate: '同平台构建号已存在' },
    )

    return true
  }

  /**
   * 切换发布状态。
   * 发布时会先撤销同平台旧发布，再发布当前草稿，确保同平台只有一条生效版本。
   */
  async updatePublishStatus(dto: UpdatePublishedStatusDto, userId: number) {
    const release = await this.findReleaseById(dto.id, { withStoreLinks: true })
    if (!release) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '更新版本不存在',
      )
    }

    if (!dto.isPublished) {
      if (!release.isPublished) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '未发布版本不允许下线',
        )
      }

      await this.drizzle.withErrorHandling(
        () =>
          this.db
            .update(this.appUpdateRelease)
            .set({
              isPublished: false,
              updatedById: userId,
            })
            .where(eq(this.appUpdateRelease.id, dto.id)),
        { notFound: '更新版本不存在' },
      )

      return true
    }

    if (release.isPublished) {
      return true
    }

    this.assertDistributionTargets(release)

    await this.drizzle.withTransaction(async tx => {
      await tx
        .update(this.appUpdateRelease)
        .set({
          isPublished: false,
          updatedById: userId,
        })
        .where(
          and(
            eq(this.appUpdateRelease.platform, release.platform),
            eq(this.appUpdateRelease.isPublished, true),
          ),
        )

      const result = await tx
        .update(this.appUpdateRelease)
        .set({
          isPublished: true,
          publishedAt: new Date(),
          updatedById: userId,
        })
        .where(eq(this.appUpdateRelease.id, dto.id))

      this.drizzle.assertAffectedRows(result, '更新版本不存在')
    })

    return true
  }

  /**
   * 客户端检查更新。
   * 仅按平台挑选最新发布版本，渠道只影响商店地址匹配，不影响版本选择。
   */
  async checkUpdate(dto: AppUpdateCheckDto) {
    const latestRelease = await this.findLatestPublishedRelease(dto.platform)
    if (!latestRelease || dto.buildCode >= latestRelease.buildCode) {
      return { hasUpdate: false }
    }

    const storeLinks = this.sortStoreLinks(latestRelease.storeLinks ?? []).map(
      item => this.toStoreLinkSnapshot(item),
    )
    const matchedStoreLink = this.resolveMatchedStoreLink(
      storeLinks,
      dto.channelCode,
    )

    return {
      hasUpdate: true,
      updateType: latestRelease.forceUpdate
        ? AppUpdateTypeEnum.FORCE
        : AppUpdateTypeEnum.OPTIONAL,
      latestVersionName: latestRelease.versionName,
      latestBuildCode: latestRelease.buildCode,
      releaseNotes: latestRelease.releaseNotes,
      packageUrl: latestRelease.packageUrl,
      customDownloadUrl: latestRelease.customDownloadUrl,
      storeLinks,
      matchedStoreLink,
    }
  }

  /**
   * 查询单条发布记录。
   * 可选补齐商店地址，避免后台详情和客户端检查各自拼装第二套查询。
   */
  private async findReleaseById(
    id: number,
    options: {
      withStoreLinks?: boolean
    } = {},
    db: Db = this.db,
  ) {
    const release = await db.query.appUpdateRelease.findFirst({
      where: { id },
      with: options.withStoreLinks
        ? {
            storeLinks: {
              columns: {
                id: true,
                channelCode: true,
                channelName: true,
                storeUrl: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          }
        : undefined,
    })

    return release as ReleaseWithStoreLinks | undefined
  }

  /**
   * 查询指定平台当前最新发布版本。
   * 若同平台历史上存在多个已发布版本，统一以 buildCode 和 id 倒序收口到最新一条。
   */
  private async findLatestPublishedRelease(platform: string) {
    const release = await this.db.query.appUpdateRelease.findFirst({
      where: {
        platform,
        isPublished: true,
      },
      orderBy: (appUpdateRelease, operators) => [
        operators.desc(appUpdateRelease.buildCode),
        operators.desc(appUpdateRelease.id),
      ],
      with: {
        storeLinks: {
          columns: {
            id: true,
            channelCode: true,
            channelName: true,
            storeUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    return release as ReleaseWithStoreLinks | undefined
  }

  /**
   * 统计分页结果内各发布记录的商店地址数量。
   */
  private async findStoreLinkCountMap(releaseIds: number[]) {
    if (releaseIds.length === 0) {
      return new Map<number, number>()
    }

    const rows = await this.db
      .select({
        releaseId: this.appUpdateStoreLink.releaseId,
        count: sql<number>`count(*)::int`,
      })
      .from(this.appUpdateStoreLink)
      .where(inArray(this.appUpdateStoreLink.releaseId, releaseIds))
      .groupBy(this.appUpdateStoreLink.releaseId)

    return new Map(rows.map(row => [row.releaseId, row.count]))
  }

  /**
   * 标准化写入 DTO。
   * 统一收口地址、包来源、商店渠道编码和可空字段，避免 create/update 分叉。
   */
  private normalizeWriteDto(dto: AppUpdateReleaseWriteDto) {
    const storeLinks = this.normalizeStoreLinks(dto.storeLinks)
    const releaseNotes = this.normalizeNullableString(dto.releaseNotes)
    const packageUrl = this.normalizeNullableString(dto.packageUrl)
    const customDownloadUrl = this.normalizeNullableString(dto.customDownloadUrl)
    const packageOriginalName = this.normalizeNullableString(
      dto.packageOriginalName,
    )
    const packageMimeType = this.normalizeNullableString(dto.packageMimeType)

    if (dto.packageSourceType && !packageUrl) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '安装包来源已设置时必须填写安装包地址',
      )
    }
    if (!dto.packageSourceType && packageUrl) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '填写安装包地址时必须指定安装包来源',
      )
    }

    if (dto.packageSourceType === AppUpdatePackageSourceEnum.UPLOAD) {
      if (!this.isUploadPackageUrl(packageUrl)) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '上传安装包地址必须是上传返回的文件地址或 CDN 地址',
        )
      }
    }

    if (dto.packageSourceType === AppUpdatePackageSourceEnum.URL) {
      if (!this.isHttpUrl(packageUrl)) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '外部安装包地址必须是合法的 HTTP/HTTPS URL',
        )
      }
    }

    const packageFileSize =
      dto.packageFileSize === undefined ? null : dto.packageFileSize

    const release: AppUpdateReleaseInsert = {
      platform: dto.platform,
      versionName: dto.versionName.trim(),
      buildCode: dto.buildCode,
      releaseNotes,
      forceUpdate: dto.forceUpdate,
      packageSourceType: packageUrl ? dto.packageSourceType ?? null : null,
      packageUrl,
      packageOriginalName:
        dto.packageSourceType === AppUpdatePackageSourceEnum.UPLOAD
          ? packageOriginalName
          : null,
      packageFileSize:
        dto.packageSourceType === AppUpdatePackageSourceEnum.UPLOAD
          ? packageFileSize
          : null,
      packageMimeType:
        dto.packageSourceType === AppUpdatePackageSourceEnum.UPLOAD
          ? packageMimeType
          : null,
      customDownloadUrl,
    }

    return {
      release,
      storeLinks,
    }
  }

  /**
   * 统一替换商店地址集合。
   * 当前采用整组覆盖，避免后台编辑时出现旧渠道残留。
   */
  private async replaceStoreLinks(
    db: Db,
    releaseId: number,
    storeLinks: AppUpdateStoreLinkInputDto[],
  ) {
    await db
      .delete(this.appUpdateStoreLink)
      .where(eq(this.appUpdateStoreLink.releaseId, releaseId))

    if (storeLinks.length === 0) {
      return
    }

    const values: AppUpdateStoreLinkInsert[] = storeLinks.map(item => ({
      releaseId,
      channelCode: item.channelCode,
      channelName: item.channelName,
      storeUrl: item.storeUrl,
    }))

    await db.insert(this.appUpdateStoreLink).values(values)
  }

  /**
   * 标准化商店地址输入。
   * 渠道编码统一转小写，重复编码直接拒绝，避免客户端匹配歧义。
   */
  private normalizeStoreLinks(storeLinks?: AppUpdateStoreLinkInputDto[]) {
    const normalizedLinks = (storeLinks ?? []).map(item => ({
      channelCode: item.channelCode.trim().toLowerCase(),
      channelName: item.channelName.trim(),
      storeUrl: item.storeUrl.trim(),
    }))

    const seenChannelCodes = new Set<string>()
    for (const link of normalizedLinks) {
      if (seenChannelCodes.has(link.channelCode)) {
        throw new BusinessException(
          BusinessErrorCode.STATE_CONFLICT,
          '商店渠道编码不能重复',
        )
      }

      seenChannelCodes.add(link.channelCode)
    }

    return normalizedLinks
  }

  /**
   * 发布前校验至少存在一种分发目标。
   */
  private assertDistributionTargets(release: ReleaseWithStoreLinks) {
    const hasDistributionTarget =
      Boolean(release.packageUrl) ||
      Boolean(release.customDownloadUrl) ||
      Boolean(release.storeLinks?.length)

    if (!hasDistributionTarget) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '发布版本前至少需要配置一种分发地址',
      )
    }
  }

  /**
   * 规范化可空字符串。
   * 空字符串统一收口为 null，避免数据库里出现无意义空值。
   */
  private normalizeNullableString(value?: string | null) {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }

  /**
   * 判断是否为 HTTP/HTTPS URL。
   */
  private isHttpUrl(value?: string | null) {
    return Boolean(value && HTTP_URL_REGEXP.test(value))
  }

  /**
   * 判断是否为上传安装包地址。
   * 本地上传返回 `/files/...`，云存储上传可能返回 HTTP/HTTPS 绝对地址。
   */
  private isUploadPackageUrl(value?: string | null) {
    return Boolean(value?.startsWith('/files/') || this.isHttpUrl(value))
  }

  /**
   * 后台详情映射。
   * 统一保证商店地址输出顺序稳定，减少管理端 diff 抖动。
   */
  private toReleaseDetailDto(release: ReleaseWithStoreLinks) {
    return {
      ...release,
      storeLinks: this.sortStoreLinks(release.storeLinks ?? []),
    } as AppUpdateReleaseDetailDto
  }

  /**
   * 商店地址输出快照。
   * app 侧只消费渠道与地址，不暴露内部审计字段。
   */
  private toStoreLinkSnapshot(
    storeLink: Pick<
      AppUpdateStoreLinkSelect,
      'channelCode' | 'channelName' | 'storeUrl'
    >,
  ): AppUpdateStoreLinkSnapshotDto {
    return {
      channelCode: storeLink.channelCode,
      channelName: storeLink.channelName,
      storeUrl: storeLink.storeUrl,
    }
  }

  /**
   * 商店地址排序。
   * `default` 渠道优先，其余渠道按编码升序输出，保证前后端结果稳定。
   */
  private sortStoreLinks(storeLinks: AppUpdateStoreLinkSelect[]) {
    return [...storeLinks].sort((left, right) => {
      if (
        left.channelCode === DEFAULT_APP_UPDATE_CHANNEL_CODE &&
        right.channelCode !== DEFAULT_APP_UPDATE_CHANNEL_CODE
      ) {
        return -1
      }
      if (
        right.channelCode === DEFAULT_APP_UPDATE_CHANNEL_CODE &&
        left.channelCode !== DEFAULT_APP_UPDATE_CHANNEL_CODE
      ) {
        return 1
      }

      return (
        left.channelCode.localeCompare(right.channelCode) || left.id - right.id
      )
    })
  }

  /**
   * 根据客户端渠道匹配商店地址。
   * 匹配顺序：精确渠道 -> default -> null。
   */
  private resolveMatchedStoreLink(
    storeLinks: AppUpdateStoreLinkSnapshotDto[],
    channelCode?: string,
  ) {
    const normalizedChannelCode = channelCode?.trim().toLowerCase()
    if (normalizedChannelCode) {
      const exactMatch = storeLinks.find(
        item => item.channelCode === normalizedChannelCode,
      )
      if (exactMatch) {
        return exactMatch
      }
    }

    return (
      storeLinks.find(
        item => item.channelCode === DEFAULT_APP_UPDATE_CHANNEL_CODE,
      ) ?? null
    )
  }
}
