import type {
  ComicVersionBatchUpdateEnabledStatusRequest,
  ComicVersionBatchUpdateEnabledStatusResponse,
  ComicVersionBatchUpdatePublishStatusRequest,
  ComicVersionBatchUpdatePublishStatusResponse,
  ComicVersionBatchUpdateRecommendedStatusRequest,
  ComicVersionBatchUpdateRecommendedStatusResponse,
  ComicVersionCreateRequest,
  ComicVersionCreateResponse,
  ComicVersionDeleteRequest,
  ComicVersionDeleteResponse,
  ComicVersionDetailRequest,
  ComicVersionDetailResponse,
  ComicVersionPageRequest,
  ComicVersionPageResponse,
  ComicVersionUpdateRequest,
  ComicVersionUpdateResponse,
} from './types/comicVersion.d';

import { requestClient } from '#/utils/request';

/**
 * 创建漫画版本
 */
export async function comicVersionCreateApi(
  params: ComicVersionCreateRequest,
): Promise<ComicVersionCreateResponse> {
  return requestClient.post<ComicVersionCreateResponse>(
    '/api/admin/work/comic-version/create',
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
    '/api/admin/work/comic-version/page',
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
    '/api/admin/work/comic-version/detail',
    { params },
  );
}

/**
 * 更新漫画版本信息
 */
export async function comicVersionUpdateApi(
  params: ComicVersionUpdateRequest,
): Promise<ComicVersionUpdateResponse> {
  return requestClient.post<ComicVersionUpdateResponse>(
    '/api/admin/work/comic-version/update',
    params,
  );
}

/**
 * 批量更新版本发布状态
 */
export async function comicVersionBatchUpdatePublishStatusApi(
  params: ComicVersionBatchUpdatePublishStatusRequest,
): Promise<ComicVersionBatchUpdatePublishStatusResponse> {
  return requestClient.post<ComicVersionBatchUpdatePublishStatusResponse>(
    '/api/admin/work/comic-version/batch-update-publish-status',
    params,
  );
}

/**
 * 批量更新版本推荐状态
 */
export async function comicVersionBatchUpdateRecommendedStatusApi(
  params: ComicVersionBatchUpdateRecommendedStatusRequest,
): Promise<ComicVersionBatchUpdateRecommendedStatusResponse> {
  return requestClient.post<ComicVersionBatchUpdateRecommendedStatusResponse>(
    '/api/admin/work/comic-version/batch-update-recommended-status',
    params,
  );
}

/**
 * 批量更新版本启用状态
 */
export async function comicVersionBatchUpdateEnabledStatusApi(
  params: ComicVersionBatchUpdateEnabledStatusRequest,
): Promise<ComicVersionBatchUpdateEnabledStatusResponse> {
  return requestClient.post<ComicVersionBatchUpdateEnabledStatusResponse>(
    '/api/admin/work/comic-version/batch-update-enabled-status',
    params,
  );
}

/**
 * 软删除版本
 */
export async function comicVersionDeleteApi(
  params: ComicVersionDeleteRequest,
): Promise<ComicVersionDeleteResponse> {
  return requestClient.post<ComicVersionDeleteResponse>(
    '/api/admin/work/comic-version/delete',
    params,
  );
}
