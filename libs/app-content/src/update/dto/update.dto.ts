import {
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NumberProperty,
  RegexProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto, OMIT_BASE_FIELDS } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import { HTTP_URL_REGEXP } from '@libs/platform/utils/regExp'
import {
  IntersectionType,
  OmitType,
  PartialType,
  PickType,
} from '@nestjs/swagger'
import {
  AppUpdatePackageSourceEnum,
  AppUpdatePlatformEnum,
  AppUpdatePopupBackgroundPositionEnum,
  AppUpdateTypeEnum,
} from '../update.constant'

/**
 * 更新发布基础 DTO。
 * 严格对应 app_update_release 表的对外字段。
 */
export class BaseAppUpdateReleaseDto extends BaseDto {
  @EnumProperty({
    description: '发布平台（1=苹果端；2=安卓端）',
    example: AppUpdatePlatformEnum.ANDROID,
    enum: AppUpdatePlatformEnum,
    required: true,
  })
  platform!: AppUpdatePlatformEnum

  @StringProperty({
    description: '展示版本号',
    example: '1.2.0',
    required: true,
    maxLength: 50,
  })
  versionName!: string

  @NumberProperty({
    description: '内部构建号',
    example: 120,
    required: true,
    min: 1,
  })
  buildCode!: number

  @StringProperty({
    description: '更新说明',
    example: '修复已知问题并优化安装流程',
    required: false,
    maxLength: 5000,
  })
  releaseNotes?: string | null

  @BooleanProperty({
    description: '是否强制更新',
    example: false,
    required: true,
    default: false,
  })
  forceUpdate!: boolean

  @EnumProperty({
    description: '安装包来源（1=后台上传；2=外部下载地址；3=外部中转页）',
    example: AppUpdatePackageSourceEnum.UPLOAD,
    enum: AppUpdatePackageSourceEnum,
    required: false,
  })
  packageSourceType?: AppUpdatePackageSourceEnum | null

  @StringProperty({
    description: '安装包地址',
    example: '/files/appupdate/2026-04-12/package/release.apk',
    required: false,
    maxLength: 1000,
  })
  packageUrl?: string | null

  @StringProperty({
    description: '上传安装包原始文件名',
    example: 'release.apk',
    required: false,
    maxLength: 255,
  })
  packageOriginalName?: string | null

  @NumberProperty({
    description: '上传安装包大小（字节）',
    example: 104857600,
    required: false,
    min: 1,
  })
  packageFileSize?: number | null

  @StringProperty({
    description: '上传安装包 MIME 类型',
    example: 'application/vnd.android.package-archive',
    required: false,
    maxLength: 100,
  })
  packageMimeType?: string | null

  @StringProperty({
    description: '自定义下载页地址',
    example: 'https://download.example.com/app',
    required: false,
    maxLength: 1000,
    type: 'url',
  })
  customDownloadUrl?: string | null

  @StringProperty({
    description: '更新弹窗背景图地址',
    example: 'https://cdn.example.com/app-update/bg.png',
    required: false,
    maxLength: 255,
  })
  popupBackgroundImage?: string | null

  @EnumProperty({
    description:
      '更新弹窗背景图位置（居中、顶部居中、顶部靠左、顶部靠右、底部居中、底部靠左、底部靠右、左侧居中、右侧居中）',
    example: AppUpdatePopupBackgroundPositionEnum.CENTER,
    enum: AppUpdatePopupBackgroundPositionEnum,
    required: false,
    default: AppUpdatePopupBackgroundPositionEnum.CENTER,
  })
  popupBackgroundPosition?: AppUpdatePopupBackgroundPositionEnum

  @BooleanProperty({
    description: '是否已发布',
    example: false,
    required: true,
    default: false,
  })
  isPublished!: boolean

  @DateProperty({
    description: '发布时间',
    example: '2026-04-12T10:30:00.000Z',
    required: false,
  })
  publishedAt?: Date | null

  @NumberProperty({
    description: '创建人 ID',
    example: 1,
    required: false,
  })
  createdById?: number

  @NumberProperty({
    description: '更新人 ID',
    example: 1,
    required: false,
  })
  updatedById?: number
}

/** 写入场景需排除的字段：基础字段 + 发布状态 + 审计字段 */
const WRITE_OMIT_FIELDS = [
  ...OMIT_BASE_FIELDS,
  'isPublished',
  'publishedAt',
  'createdById',
  'updatedById',
] as const

/**
 * 更新发布写入 DTO。
 * 基于基础 DTO 排除不可写入字段，仅对 customDownloadUrl 追加 URL 格式校验。
 */
export class AppUpdateReleaseWriteDto extends OmitType(
  BaseAppUpdateReleaseDto,
  WRITE_OMIT_FIELDS,
) {
  @RegexProperty({
    description: '自定义下载页地址',
    example: 'https://download.example.com/app',
    required: false,
    regex: HTTP_URL_REGEXP,
    message: '自定义下载页地址必须是合法的 HTTP/HTTPS URL',
  })
  customDownloadUrl?: string
}

/**
 * 创建更新发布 DTO。
 */
export class CreateAppUpdateReleaseDto extends AppUpdateReleaseWriteDto {}

/**
 * 更新更新发布 DTO。
 */
export class UpdateAppUpdateReleaseDto extends IntersectionType(
  IdDto,
  AppUpdateReleaseWriteDto,
) {}

/**
 * 后台分页查询 DTO。
 */
export class QueryAppUpdateReleaseDto extends IntersectionType(
  PageDto,
  PartialType(
    PickType(BaseAppUpdateReleaseDto, [
      'platform',
      'versionName',
      'buildCode',
      'forceUpdate',
      'isPublished',
    ] as const),
  ),
) {}

/**
 * 后台详情 DTO。
 */
export class AppUpdateReleaseDetailDto extends BaseAppUpdateReleaseDto {}

/**
 * 后台列表 DTO。
 */
export class AppUpdateReleaseListItemDto extends PickType(
  BaseAppUpdateReleaseDto,
  [
    'id',
    'platform',
    'versionName',
    'buildCode',
    'forceUpdate',
    'isPublished',
    'publishedAt',
    'createdAt',
    'updatedAt',
  ] as const,
) {
  @BooleanProperty({
    description: '是否配置安装包地址',
    example: true,
    required: true,
    validation: false,
  })
  hasPackageUrl!: boolean

  @BooleanProperty({
    description: '是否配置自定义下载页地址',
    example: true,
    required: true,
    validation: false,
  })
  hasCustomDownloadUrl!: boolean
}

/**
 * App 端更新检查 DTO。
 */
export class AppUpdateCheckDto extends IntersectionType(
  PickType(BaseAppUpdateReleaseDto, ['platform'] as const),
  PartialType(PickType(BaseAppUpdateReleaseDto, ['versionName'] as const)),
  PickType(BaseAppUpdateReleaseDto, ['buildCode'] as const),
) {}

/**
 * App 端更新检查响应字段（从 BaseAppUpdateReleaseDto 中选取）。
 */
const UPDATE_RESPONSE_PICK_FIELDS = [
  'releaseNotes',
  'packageUrl',
  'customDownloadUrl',
  'popupBackgroundImage',
  'popupBackgroundPosition',
] as const

/**
 * App 端更新检查响应 DTO。
 */
export class AppUpdateCheckResponseDto extends IntersectionType(
  PartialType(PickType(BaseAppUpdateReleaseDto, UPDATE_RESPONSE_PICK_FIELDS)),
) {
  @BooleanProperty({
    description: '是否存在更新',
    example: true,
    required: true,
    validation: false,
  })
  hasUpdate!: boolean

  @EnumProperty({
    description: '更新类型（optional=普通更新；force=强制更新）',
    example: AppUpdateTypeEnum.FORCE,
    enum: AppUpdateTypeEnum,
    required: false,
    validation: false,
  })
  updateType?: AppUpdateTypeEnum

  // 覆盖字段名以区分客户端版本与最新版本
  @StringProperty({
    description: '最新展示版本号',
    example: '1.2.0',
    required: false,
    validation: false,
  })
  latestVersionName?: string

  @NumberProperty({
    description: '最新内部构建号',
    example: 120,
    required: false,
    validation: false,
  })
  latestBuildCode?: number
}
