import { requestClient } from '#/utils/request';
import type {
  CreateComicVersionRequest,
  CreateComicVersionResponse,
  ComicVersionPageRequest,
  ComicVersionPageResponse,
  ComicVersionDetailRequest,
  ComicVersionDetailResponse,
  UpdateComicVersionRequest,
  UpdateComicVersionResponse,
  BatchUpdateVersionPublishStatusRequest,
  BatchUpdateVersionPublishStatusResponse,
  BatchUpdateVersionRecommendedStatusRequest,
  BatchUpdateVersionRecommendedStatusResponse,
  BatchUpdateVersionEnabledStatusRequest,
  BatchUpdateVersionEnabledStatusResponse,
  DeleteComicVersionRequest,
  DeleteComicVersionResponse,
  CreateComicVersionDto,
  IdDto,
  BaseComicVersionDto,
  ComicVersionDetailResponseDto,
  UpdateComicVersionDto,
  BatchPublishDto,
  CountDto,
  UpdateVersionRecommendedStatusDto,
  UpdateVersionEnabledStatusDto,
} from './types/comicVersion.d';

/**
 * 创建漫画版本
 */
export async function createComicVersionApi(
  params: CreateComicVersionRequest,
): Promise<CreateComicVersionResponse> {
  return requestClient.post<CreateComicVersionResponse>(
    '/api/admin/work/comic-version/create-comic-version',
    params,
  );
}

/**
 * 分页查询漫画版本列表
 */
export async function comicVersionPageApi(
  params: ComicVersionPageRequest,
): Promise<ComicVersionPageResponse> {
  return requestClient.get<ComicVersionPageResponse>(
    '/api/admin/work/comic-version/comic-version-page',
    { params },
  );
}

/**
 * 获取漫画版本详情
 */
export async function comicVersionDetailApi(
  params: ComicVersionDetailRequest,
): Promise<ComicVersionDetailResponse> {
  return requestClient.get<ComicVersionDetailResponse>(
    '/api/admin/work/comic-version/comic-version-detail',
    { params },
  );
}

/**
 * 更新漫画版本信息
 */
export async function updateComicVersionApi(
  params: UpdateComicVersionRequest,
): Promise<UpdateComicVersionResponse> {
  return requestClient.post<UpdateComicVersionResponse>(
    '/api/admin/work/comic-version/update-comic-version',
    params,
  );
}

/**
 * 批量更新版本发布状态
 */
export async function batchUpdateVersionPublishStatusApi(
  params: BatchUpdateVersionPublishStatusRequest,
): Promise<BatchUpdateVersionPublishStatusResponse> {
  return requestClient.post<BatchUpdateVersionPublishStatusResponse>(
    '/api/admin/work/comic-version/batch-update-version-publish-status',
    params,
  );
}

/**
 * 批量更新版本推荐状态
 */
export async function batchUpdateVersionRecommendedStatusApi(
  params: BatchUpdateVersionRecommendedStatusRequest,
): Promise<BatchUpdateVersionRecommendedStatusResponse> {
  return requestClient.post<BatchUpdateVersionRecommendedStatusResponse>(
    '/api/admin/work/comic-version/batch-update-version-recommended-status',
    params,
  );
}

/**
 * 批量更新版本启用状态
 */
export async function batchUpdateVersionEnabledStatusApi(
  params: BatchUpdateVersionEnabledStatusRequest,
): Promise<BatchUpdateVersionEnabledStatusResponse> {
  return requestClient.post<BatchUpdateVersionEnabledStatusResponse>(
    '/api/admin/work/comic-version/batch-update-version-enabled-status',
    params,
  );
}

/**
 * 软删除版本
 */
export async function deleteComicVersionApi(
  params: DeleteComicVersionRequest,
): Promise<DeleteComicVersionResponse> {
  return requestClient.post<DeleteComicVersionResponse>(
    '/api/admin/work/comic-version/delete-comic-version',
    params,
  );
}
