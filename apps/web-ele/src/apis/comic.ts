import type {
  ComicBatchUpdateHotRequest,
  ComicBatchUpdateHotResponse,
  ComicBatchUpdateNewRequest,
  ComicBatchUpdateNewResponse,
  ComicBatchUpdateRecommendedRequest,
  ComicBatchUpdateRecommendedResponse,
  ComicBatchUpdateStatusRequest,
  ComicBatchUpdateStatusResponse,
  ComicCreateRequest,
  ComicCreateResponse,
  ComicDeleteRequest,
  ComicDeleteResponse,
  ComicDetailRequest,
  ComicDetailResponse,
  ComicPageRequest,
  ComicPageResponse,
  ComicUpdateRequest,
  ComicUpdateResponse,
} from './types/comic.d';

import { requestClient } from '#/utils/request';

/**
 * 创建漫画
 */
export async function comicCreateApi(
  params: ComicCreateRequest,
): Promise<ComicCreateResponse> {
  return requestClient.post<ComicCreateResponse>(
    '/api/admin/work/comic/create',
    params,
  );
}

/**
 * 分页查询漫画列表
 */
export async function comicPageApi(
  params?: ComicPageRequest,
): Promise<ComicPageResponse> {
  return requestClient.get<ComicPageResponse>('/api/admin/work/comic/page', {
    params,
  });
}

/**
 * 获取漫画详情
 */
export async function comicDetailApi(
  params: ComicDetailRequest,
): Promise<ComicDetailResponse> {
  return requestClient.get<ComicDetailResponse>(
    '/api/admin/work/comic/detail',
    { params },
  );
}

/**
 * 更新漫画信息
 */
export async function comicUpdateApi(
  params: ComicUpdateRequest,
): Promise<ComicUpdateResponse> {
  return requestClient.post<ComicUpdateResponse>(
    '/api/admin/work/comic/update',
    params,
  );
}

/**
 * 批量更新漫画发布状态
 */
export async function comicBatchUpdateStatusApi(
  params: ComicBatchUpdateStatusRequest,
): Promise<ComicBatchUpdateStatusResponse> {
  return requestClient.post<ComicBatchUpdateStatusResponse>(
    '/api/admin/work/comic/batch-update-status',
    params,
  );
}

/**
 * 批量更新漫画推荐状态
 */
export async function comicBatchUpdateRecommendedApi(
  params: ComicBatchUpdateRecommendedRequest,
): Promise<ComicBatchUpdateRecommendedResponse> {
  return requestClient.post<ComicBatchUpdateRecommendedResponse>(
    '/api/admin/work/comic/batch-update-recommended',
    params,
  );
}

/**
 * 批量更新漫画热门状态
 */
export async function comicBatchUpdateHotApi(
  params: ComicBatchUpdateHotRequest,
): Promise<ComicBatchUpdateHotResponse> {
  return requestClient.post<ComicBatchUpdateHotResponse>(
    '/api/admin/work/comic/batch-update-hot',
    params,
  );
}

/**
 * 批量更新漫画新作状态
 */
export async function comicBatchUpdateNewApi(
  params: ComicBatchUpdateNewRequest,
): Promise<ComicBatchUpdateNewResponse> {
  return requestClient.post<ComicBatchUpdateNewResponse>(
    '/api/admin/work/comic/batch-update-new',
    params,
  );
}

/**
 * 软删除漫画
 */
export async function comicDeleteApi(
  params: ComicDeleteRequest,
): Promise<ComicDeleteResponse> {
  return requestClient.post<ComicDeleteResponse>(
    '/api/admin/work/comic/delete',
    params,
  );
}
