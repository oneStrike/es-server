import type { AppUpdateReleaseInsert, AppUpdateReleaseSelect } from '@db/schema'
import type { SQL } from 'drizzle-orm'
import type {
  AppUpdateCheckResponseDto,
  AppUpdateReleaseDetailDto,
  AppUpdateReleaseListItemDto,
} from './dto/update.dto'
import { buildILikeCondition, DrizzleService, toPageResult } from '@db/core'

import { BusinessErrorCode } from '@libs/platform/constant'
import { IdDto, UpdatePublishedStatusDto } from '@libs/platform/dto'
import { BusinessException } from '@libs/platform/exceptions'
import { HTTP_URL_REGEXP } from '@libs/platform/utils'
import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import {
  AppUpdateCheckDto,
  AppUpdateReleaseWriteDto,
  QueryAppUpdateReleaseDto,
  UpdateAppUpdateReleaseDto,
} from './dto/update.dto'
import {
  AppUpdatePackageSourceEnum,
  AppUpdatePlatformEnum,
  AppUpdatePopupBackgroundPositionEnum,
  AppUpdateTypeEnum,
} from './update.constant'

/**
 * App 更新服务。
 * 负责草稿写入、发布切换、后台查询与客户端更新检查。
 */
@Injectable()
export class AppUpdateService {
  constructor(private readonly drizzle: DrizzleService) {}

  // 数据库连接实例。
  private get db() {
    return this.drizzle.db
  }

  // 更新发布表。
  private get appUpdateRelease() {
    return this.drizzle.schema.appUpdateRelease
  }

  // 后台版本列表只读取当前列表 contract，安装包地址仅用于派生 hasPackageUrl。
  private buildAppUpdateReleasePageSelect() {
    return {
      id: this.appUpdateRelease.id,
      platform: this.appUpdateRelease.platform,
      versionName: this.appUpdateRelease.versionName,
      buildCode: this.appUpdateRelease.buildCode,
      forceUpdate: this.appUpdateRelease.forceUpdate,
      isPublished: this.appUpdateRelease.isPublished,
      publishedAt: this.appUpdateRelease.publishedAt,
      createdAt: this.appUpdateRelease.createdAt,
      updatedAt: this.appUpdateRelease.updatedAt,
      packageUrl: this.appUpdateRelease.packageUrl,
    }
  }

  // 后台详情的完整当前 contract，逐项固定，避免 release 表演进时默认查询新增字段。
  private getAppUpdateReleaseDetailColumns() {
    return {
      id: true,
      platform: true,
      versionName: true,
      buildCode: true,
      releaseNotes: true,
      forceUpdate: true,
      packageSourceType: true,
      packageUrl: true,
      packageOriginalName: true,
      packageFileSize: true,
      packageMimeType: true,
      popupBackgroundImage: true,
      popupBackgroundPosition: true,
      isPublished: true,
      publishedAt: true,
      createdById: true,
      updatedById: true,
      createdAt: true,
      updatedAt: true,
    } as const
  }

  // 写链只需要发布状态、平台和分发地址，不能借后台详情读取完整发布行。
  private getAppUpdateReleaseLifecycleColumns() {
    return {
      id: true,
      platform: true,
      isPublished: true,
      packageUrl: true,
    } as const
  }

  // app 更新检查只取客户端响应真正消费的字段。
  private getLatestPublishedReleaseColumns() {
    return {
      forceUpdate: true,
      versionName: true,
      buildCode: true,
      releaseNotes: true,
      packageUrl: true,
      popupBackgroundImage: true,
      popupBackgroundPosition: true,
    } as const
  }

  // 分页查询版本发布列表。 列表接口只返回后台概览字段，并补齐分发目标摘要。
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

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const page = this.drizzle.buildPage(queryDto)
    const orderQuery = this.drizzle.buildOrderBy(
      queryDto.orderBy?.trim()
        ? queryDto.orderBy
        : { buildCode: 'desc' as const },
      { table: this.appUpdateRelease },
    )
    const [list, total] = await Promise.all([
      this.db
        .select(this.buildAppUpdateReleasePageSelect())
        .from(this.appUpdateRelease)
        .where(where)
        .orderBy(...orderQuery.orderBySql)
        .limit(page.limit)
        .offset(page.offset),
      this.db.$count(this.appUpdateRelease, where),
    ])
    const result = toPageResult(list, total, page)

    return {
      ...result,
      list: result.list.map<AppUpdateReleaseListItemDto>((item) => ({
        id: item.id,
        platform: item.platform,
        versionName: item.versionName,
        buildCode: item.buildCode,
        forceUpdate: item.forceUpdate,
        isPublished: item.isPublished,
        publishedAt: item.publishedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        hasPackageUrl: Boolean(item.packageUrl),
      })),
    }
  }

  // 查询版本发布详情。 详情接口直接回填版本配置，避免管理端自行补默认值。
  async findDetail(dto: IdDto): Promise<AppUpdateReleaseDetailDto> {
    const release = await this.findReleaseDetailById(dto.id)
    if (!release) {
      throw new BusinessException(
        BusinessErrorCode.RESOURCE_NOT_FOUND,
        '更新版本不存在',
      )
    }

    return this.toReleaseDetailDto(release)
  }

  // 创建更新草稿。 写入前会规范化地址，并校验同平台构建号唯一约束。
  async create(dto: AppUpdateReleaseWriteDto, userId: number) {
    const normalized = await this.normalizeWriteDto(dto)

    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction({
          execute: async (tx) => {
            await tx.insert(this.appUpdateRelease).values({
              ...normalized.release,
              createdById: userId,
              updatedById: userId,
            })
          },
        }),
      { duplicate: '同平台构建号已存在' },
    )

    return true
  }

  // 更新更新草稿。 已发布版本禁止原地编辑，避免线上版本被静默篡改。
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
    const normalized = await this.normalizeWriteDto(writeDto)

    await this.drizzle.withErrorHandling(
      async () =>
        this.drizzle.withTransaction({
          execute: async (tx) => {
            const result = await tx
              .update(this.appUpdateRelease)
              .set({
                ...normalized.release,
                updatedById: userId,
              })
              .where(eq(this.appUpdateRelease.id, id))

            this.drizzle.assertAffectedRows(result, '更新版本不存在')
          },
        }),
      { duplicate: '同平台构建号已存在' },
    )

    return true
  }

  // 切换发布状态。 发布时会先撤销同平台旧发布，再发布当前草稿，确保同平台只有一条生效版本。
  async updatePublishStatus(dto: UpdatePublishedStatusDto, userId: number) {
    const release = await this.findReleaseById(dto.id)
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

    await this.drizzle.withTransaction({
      execute: async (tx) => {
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
      },
    })

    return true
  }

  // 客户端检查更新。 仅按平台挑选最新发布版本，更新判断只依赖 buildCode。
  async checkUpdate(
    dto: AppUpdateCheckDto,
  ): Promise<AppUpdateCheckResponseDto> {
    const latestRelease = await this.findLatestPublishedRelease(dto.platform)
    if (!latestRelease || dto.buildCode >= latestRelease.buildCode) {
      return {
        hasUpdate: false,
        updateType: null,
        latestVersionName: null,
        latestBuildCode: null,
        releaseNotes: null,
        packageUrl: null,
        popupBackgroundImage: null,
        popupBackgroundPosition: null,
      }
    }

    return {
      hasUpdate: true,
      updateType: latestRelease.forceUpdate
        ? AppUpdateTypeEnum.FORCE
        : AppUpdateTypeEnum.OPTIONAL,
      latestVersionName: latestRelease.versionName,
      latestBuildCode: latestRelease.buildCode,
      releaseNotes: latestRelease.releaseNotes ?? null,
      packageUrl: latestRelease.packageUrl ?? null,
      popupBackgroundImage: latestRelease.popupBackgroundImage ?? null,
      popupBackgroundPosition:
        (latestRelease.popupBackgroundPosition as AppUpdatePopupBackgroundPositionEnum | null) ??
        null,
    }
  }

  // 查询单条发布记录。 统一从发布表读取草稿或已发布版本。
  private async findReleaseById(id: number) {
    const release = await this.db.query.appUpdateRelease.findFirst({
      where: { id },
      columns: this.getAppUpdateReleaseLifecycleColumns(),
    })

    return release
  }

  // 仅供后台详情使用的读取器；与 mutation 生命周期读取分离，防止写链被详情 contract 绑死。
  private async findReleaseDetailById(id: number) {
    return this.db.query.appUpdateRelease.findFirst({
      where: { id },
      columns: this.getAppUpdateReleaseDetailColumns(),
    })
  }

  // 查询指定平台当前最新发布版本。 若同平台历史上存在多个已发布版本，统一以 buildCode 和 id 倒序收口到最新一条。
  private async findLatestPublishedRelease(platform: AppUpdatePlatformEnum) {
    const release = await this.db.query.appUpdateRelease.findFirst({
      where: {
        platform,
        isPublished: true,
      },
      orderBy: (appUpdateRelease, operators) => [
        operators.desc(appUpdateRelease.buildCode),
        operators.desc(appUpdateRelease.id),
      ],
      columns: this.getLatestPublishedReleaseColumns(),
    })

    return release
  }

  // 标准化写入 DTO。 统一收口地址、包来源和可空字段，避免 create/update 分叉。
  private async normalizeWriteDto(dto: AppUpdateReleaseWriteDto) {
    const releaseNotes = this.normalizeNullableString(dto.releaseNotes)
    const packageUrl = this.normalizeNullableString(dto.packageUrl)
    const popupBackgroundImage = this.normalizeNullableString(
      dto.popupBackgroundImage,
    )
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

    if (
      dto.packageSourceType &&
      [
        AppUpdatePackageSourceEnum.URL,
        AppUpdatePackageSourceEnum.CUSTOM,
      ].includes(dto.packageSourceType)
    ) {
      if (!this.isHttpsUrl(packageUrl)) {
        throw new BusinessException(
          BusinessErrorCode.OPERATION_NOT_ALLOWED,
          '外部安装包地址必须是合法的 HTTPS URL',
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
      packageSourceType: packageUrl ? (dto.packageSourceType ?? null) : null,
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
      popupBackgroundImage,
      popupBackgroundPosition:
        dto.popupBackgroundPosition ??
        AppUpdatePopupBackgroundPositionEnum.CENTER,
    }

    return { release }
  }

  // 发布前校验至少存在一种分发目标。
  private assertDistributionTargets(
    release: Pick<AppUpdateReleaseSelect, 'packageUrl'>,
  ) {
    const hasDistributionTarget = Boolean(release.packageUrl)

    if (!hasDistributionTarget) {
      throw new BusinessException(
        BusinessErrorCode.OPERATION_NOT_ALLOWED,
        '发布版本前至少需要配置一种分发地址',
      )
    }
  }

  // 规范化可空字符串。 空字符串统一收口为 null，避免数据库里出现无意义空值。
  private normalizeNullableString(value?: string | null) {
    const trimmed = value?.trim()
    return trimmed || null
  }

  // 判断是否为 HTTP/HTTPS URL。
  private isHttpUrl(value?: string | null) {
    return Boolean(value && HTTP_URL_REGEXP.test(value))
  }

  // 判断是否为 HTTPS URL。 外部下载地址和中转页地址只允许加密链路，避免发布明文下载入口。
  private isHttpsUrl(value?: string | null) {
    return Boolean(value && /^https:\/\//i.test(value) && this.isHttpUrl(value))
  }

  // 判断是否为上传安装包地址。 本地上传返回 `/files/...`，云存储上传可能返回 HTTP/HTTPS 绝对地址。
  private isUploadPackageUrl(value?: string | null) {
    return Boolean(value?.startsWith('/files/') || this.isHttpUrl(value))
  }

  // 后台详情映射。 统一补齐可空默认值，减少管理端 diff 抖动。
  private toReleaseDetailDto(release: AppUpdateReleaseSelect) {
    return {
      ...release,
      releaseNotes: release.releaseNotes ?? null,
      packageSourceType: release.packageSourceType ?? null,
      packageUrl: release.packageUrl ?? null,
      packageOriginalName: release.packageOriginalName ?? null,
      packageFileSize: release.packageFileSize ?? null,
      packageMimeType: release.packageMimeType ?? null,
      popupBackgroundImage: release.popupBackgroundImage ?? null,
      publishedAt: release.publishedAt ?? null,
      createdById: release.createdById ?? null,
      updatedById: release.updatedById ?? null,
      popupBackgroundPosition:
        (release.popupBackgroundPosition as AppUpdatePopupBackgroundPositionEnum | null) ??
        null,
    }
  }
}
