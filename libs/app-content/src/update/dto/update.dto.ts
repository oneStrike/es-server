import {
  ArrayProperty,
  BooleanProperty,
  DateProperty,
  EnumProperty,
  NestedProperty,
  NumberProperty,
  RegexProperty,
  StringProperty,
} from '@libs/platform/decorators'
import { BaseDto, IdDto } from '@libs/platform/dto/base.dto'
import { PageDto } from '@libs/platform/dto/page.dto'
import { HTTP_URL_REGEXP } from '@libs/platform/utils/regExp'
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import {
  APP_UPDATE_CHANNEL_CODE_REGEXP,
  AppUpdatePackageSourceEnum,
  AppUpdatePlatformEnum,
  AppUpdatePopupBackgroundPositionEnum,
  AppUpdateTypeEnum,
} from '../update.constant'

/**
 * 商店地址基础 DTO。
 */
export class BaseAppUpdateStoreLinkDto extends BaseDto {
  @RegexProperty({
    description: '渠道编码',
    example: 'default',
    required: true,
    regex: APP_UPDATE_CHANNEL_CODE_REGEXP,
    message: '渠道编码格式不正确',
  })
  channelCode!: string

  @RegexProperty({
    description: '应用商店地址',
    example: 'https://apps.apple.com/app/id123456789',
    required: true,
    regex: HTTP_URL_REGEXP,
    message: '商店地址必须是合法的 HTTP/HTTPS URL',
  })
  storeUrl!: string
}

/**
 * 商店地址展示 DTO。
 */
export class BaseAppUpdateStoreLinkSnapshotDto extends BaseAppUpdateStoreLinkDto {
  @StringProperty({
    description: '渠道名称',
    example: '默认渠道',
    required: true,
    maxLength: 50,
  })
  channelName!: string
}

/**
 * 商店地址写入 DTO。
 */
export class AppUpdateStoreLinkInputDto extends PickType(
  BaseAppUpdateStoreLinkDto,
  ['channelCode', 'storeUrl'] as const,
) {}

/**
 * 商店地址快照 DTO。
 */
export class AppUpdateStoreLinkSnapshotDto extends PickType(
  BaseAppUpdateStoreLinkSnapshotDto,
  ['channelCode', 'channelName', 'storeUrl'] as const,
) {}

/**
 * 更新发布基础 DTO。
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
    description: '安装包来源（1=后台上传；2=外部下载地址）',
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
  createdById?: number | null

  @NumberProperty({
    description: '更新人 ID',
    example: 1,
    required: false,
  })
  updatedById?: number | null
}

/**
 * 更新发布写入 DTO。
 */
export class AppUpdateReleaseWriteDto {
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
  releaseNotes?: string

  @BooleanProperty({
    description: '是否强制更新',
    example: false,
    required: true,
    default: false,
  })
  forceUpdate!: boolean

  @EnumProperty({
    description: '安装包来源（1=后台上传；2=外部下载地址）',
    example: AppUpdatePackageSourceEnum.UPLOAD,
    enum: AppUpdatePackageSourceEnum,
    required: false,
  })
  packageSourceType?: AppUpdatePackageSourceEnum

  @StringProperty({
    description: '安装包地址',
    example: '/files/appupdate/2026-04-12/package/release.apk',
    required: false,
    maxLength: 1000,
  })
  packageUrl?: string

  @StringProperty({
    description: '上传安装包原始文件名',
    example: 'release.apk',
    required: false,
    maxLength: 255,
  })
  packageOriginalName?: string

  @NumberProperty({
    description: '上传安装包大小（字节）',
    example: 104857600,
    required: false,
    min: 1,
  })
  packageFileSize?: number

  @StringProperty({
    description: '上传安装包 MIME 类型',
    example: 'application/vnd.android.package-archive',
    required: false,
    maxLength: 100,
  })
  packageMimeType?: string

  @RegexProperty({
    description: '自定义下载页地址',
    example: 'https://download.example.com/app',
    required: false,
    regex: HTTP_URL_REGEXP,
    message: '自定义下载页地址必须是合法的 HTTP/HTTPS URL',
  })
  customDownloadUrl?: string

  @StringProperty({
    description: '更新弹窗背景图地址',
    example: 'https://cdn.example.com/app-update/bg.png',
    required: false,
    maxLength: 255,
  })
  popupBackgroundImage?: string

  @EnumProperty({
    description:
      '更新弹窗背景图位置（居中、顶部居中、顶部靠左、顶部靠右、底部居中、底部靠左、底部靠右、左侧居中、右侧居中）',
    example: AppUpdatePopupBackgroundPositionEnum.CENTER,
    enum: AppUpdatePopupBackgroundPositionEnum,
    required: false,
    default: AppUpdatePopupBackgroundPositionEnum.CENTER,
  })
  popupBackgroundPosition?: AppUpdatePopupBackgroundPositionEnum

  @ArrayProperty({
    description: '应用商店地址列表',
    itemClass: AppUpdateStoreLinkInputDto,
    required: false,
    default: [],
    maxLength: 20,
  })
  storeLinks?: AppUpdateStoreLinkInputDto[]
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
export class AppUpdateReleaseDetailDto extends BaseAppUpdateReleaseDto {
  @ArrayProperty({
    description: '应用商店地址列表',
    itemClass: AppUpdateStoreLinkSnapshotDto,
    required: false,
    validation: false,
    default: [],
  })
  storeLinks?: AppUpdateStoreLinkSnapshotDto[]
}

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

  @NumberProperty({
    description: '商店地址数量',
    example: 2,
    required: true,
    validation: false,
  })
  storeLinkCount!: number
}

/**
 * App 端更新检查 DTO。
 */
export class AppUpdateCheckDto {
  @EnumProperty({
    description: '客户端平台（1=苹果端；2=安卓端）',
    example: AppUpdatePlatformEnum.ANDROID,
    enum: AppUpdatePlatformEnum,
    required: true,
  })
  platform!: AppUpdatePlatformEnum

  @StringProperty({
    description: '客户端展示版本号',
    example: '1.0.0',
    required: true,
    maxLength: 50,
  })
  versionName!: string

  @NumberProperty({
    description: '客户端内部构建号',
    example: 100,
    required: true,
    min: 1,
  })
  buildCode!: number

  @RegexProperty({
    description: '客户端安装渠道编码',
    example: 'huawei',
    required: false,
    regex: APP_UPDATE_CHANNEL_CODE_REGEXP,
    message: '渠道编码格式不正确',
  })
  channelCode?: string
}

/**
 * App 端更新检查响应 DTO。
 */
export class AppUpdateCheckResponseDto {
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

  @StringProperty({
    description: '更新说明',
    example: '修复已知问题并优化安装流程',
    required: false,
    validation: false,
  })
  releaseNotes?: string | null

  @StringProperty({
    description: '安装包地址',
    example: 'https://cdn.example.com/app-release.apk',
    required: false,
    validation: false,
  })
  packageUrl?: string | null

  @StringProperty({
    description: '自定义下载页地址',
    example: 'https://download.example.com/app',
    required: false,
    validation: false,
  })
  customDownloadUrl?: string | null

  @StringProperty({
    description: '更新弹窗背景图地址',
    example: 'https://cdn.example.com/app-update/bg.png',
    required: false,
    validation: false,
  })
  popupBackgroundImage?: string | null

  @EnumProperty({
    description:
      '更新弹窗背景图位置（居中、顶部居中、顶部靠左、顶部靠右、底部居中、底部靠左、底部靠右、左侧居中、右侧居中）',
    example: AppUpdatePopupBackgroundPositionEnum.CENTER,
    enum: AppUpdatePopupBackgroundPositionEnum,
    required: false,
    validation: false,
  })
  popupBackgroundPosition?: AppUpdatePopupBackgroundPositionEnum

  @ArrayProperty({
    description: '应用商店地址列表',
    itemClass: AppUpdateStoreLinkSnapshotDto,
    required: false,
    validation: false,
    default: [],
  })
  storeLinks?: AppUpdateStoreLinkSnapshotDto[]

  @NestedProperty({
    description: '命中的商店地址',
    type: AppUpdateStoreLinkSnapshotDto,
    required: false,
    validation: false,
    nullable: false,
  })
  matchedStoreLink?: AppUpdateStoreLinkSnapshotDto
}
