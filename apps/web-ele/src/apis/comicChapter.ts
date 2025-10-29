import type {
  ComicChapterAddContentRequest,
  ComicChapterAddContentResponse,
  ComicChapterBatchDeleteRequest,
  ComicChapterBatchDeleteResponse,
  ComicChapterBatchUpdateContentsRequest,
  ComicChapterBatchUpdateContentsResponse,
  ComicChapterBatchUpdateStatusRequest,
  ComicChapterBatchUpdateStatusResponse,
  ComicChapterClearContentsRequest,
  ComicChapterClearContentsResponse,
  ComicChapterContentsRequest,
  ComicChapterContentsResponse,
  ComicChapterCreateRequest,
  ComicChapterCreateResponse,
  ComicChapterDeleteContentRequest,
  ComicChapterDeleteContentResponse,
  ComicChapterDetailRequest,
  ComicChapterDetailResponse,
  ComicChapterMoveContentRequest,
  ComicChapterMoveContentResponse,
  ComicChapterPageRequest,
  ComicChapterPageResponse,
  ComicChapterSwapNumbersRequest,
  ComicChapterSwapNumbersResponse,
  ComicChapterUpdateContentRequest,
  ComicChapterUpdateContentResponse,
  ComicChapterUpdateRequest,
  ComicChapterUpdateResponse,
} from './types/comicChapter.d';

import { requestClient } from '#/utils/request';

/**
 * 创建漫画章节
 */
export async function comicChapterCreateApi(
  params: ComicChapterCreateRequest,
): Promise<ComicChapterCreateResponse> {
  return requestClient.post<ComicChapterCreateResponse>(
    '/api/admin/work/comic-chapter/create',
    params,
  );
}

/**
 * 分页查询漫画章节列表
 */
export async function comicChapterPageApi(
  params: ComicChapterPageRequest,
): Promise<ComicChapterPageResponse> {
  return requestClient.get<ComicChapterPageResponse>(
    '/api/admin/work/comic-chapter/page',
    { params },
  );
}

/**
 * 获取漫画章节详情
 */
export async function comicChapterDetailApi(
  params: ComicChapterDetailRequest,
): Promise<ComicChapterDetailResponse> {
  return requestClient.get<ComicChapterDetailResponse>(
    '/api/admin/work/comic-chapter/detail',
    { params },
  );
}

/**
 * 更新漫画章节信息
 */
export async function comicChapterUpdateApi(
  params: ComicChapterUpdateRequest,
): Promise<ComicChapterUpdateResponse> {
  return requestClient.post<ComicChapterUpdateResponse>(
    '/api/admin/work/comic-chapter/update',
    params,
  );
}

/**
 * 批量软删除章节
 */
export async function comicChapterBatchDeleteApi(
  params: ComicChapterBatchDeleteRequest,
): Promise<ComicChapterBatchDeleteResponse> {
  return requestClient.post<ComicChapterBatchDeleteResponse>(
    '/api/admin/work/comic-chapter/batch-delete',
    params,
  );
}

/**
 * 批量更新章节发布状态
 */
export async function comicChapterBatchUpdateStatusApi(
  params: ComicChapterBatchUpdateStatusRequest,
): Promise<ComicChapterBatchUpdateStatusResponse> {
  return requestClient.post<ComicChapterBatchUpdateStatusResponse>(
    '/api/admin/work/comic-chapter/batch-update-status',
    params,
  );
}

/**
 * 交换两个章节的章节号
 */
export async function comicChapterSwapNumbersApi(
  params: ComicChapterSwapNumbersRequest,
): Promise<ComicChapterSwapNumbersResponse> {
  return requestClient.post<ComicChapterSwapNumbersResponse>(
    '/api/admin/work/comic-chapter/swap-numbers',
    params,
  );
}

/**
 * 获取章节内容详情
 */
export async function comicChapterContentsApi(
  params: ComicChapterContentsRequest,
): Promise<ComicChapterContentsResponse> {
  return requestClient.get<ComicChapterContentsResponse>(
    '/api/admin/work/comic-chapter/contents',
    { params },
  );
}

/**
 * 添加章节内容
 */
export async function comicChapterAddContentApi(
  params: ComicChapterAddContentRequest,
): Promise<ComicChapterAddContentResponse> {
  return requestClient.post<ComicChapterAddContentResponse>(
    '/api/admin/work/comic-chapter/add-content',
    params,
  );
}

/**
 * 更新章节内容
 */
export async function comicChapterUpdateContentApi(
  params: ComicChapterUpdateContentRequest,
): Promise<ComicChapterUpdateContentResponse> {
  return requestClient.post<ComicChapterUpdateContentResponse>(
    '/api/admin/work/comic-chapter/update-content',
    params,
  );
}

/**
 * 删除章节内容
 */
export async function comicChapterDeleteContentApi(
  params: ComicChapterDeleteContentRequest,
): Promise<ComicChapterDeleteContentResponse> {
  return requestClient.post<ComicChapterDeleteContentResponse>(
    '/api/admin/work/comic-chapter/delete-content',
    params,
  );
}

/**
 * 移动章节内容（排序）
 */
export async function comicChapterMoveContentApi(
  params: ComicChapterMoveContentRequest,
): Promise<ComicChapterMoveContentResponse> {
  return requestClient.post<ComicChapterMoveContentResponse>(
    '/api/admin/work/comic-chapter/move-content',
    params,
  );
}

/**
 * 批量更新章节内容
 */
export async function comicChapterBatchUpdateContentsApi(
  params: ComicChapterBatchUpdateContentsRequest,
): Promise<ComicChapterBatchUpdateContentsResponse> {
  return requestClient.post<ComicChapterBatchUpdateContentsResponse>(
    '/api/admin/work/comic-chapter/batch-update-contents',
    params,
  );
}

/**
 * 清空章节内容
 */
export async function comicChapterClearContentsApi(
  params: ComicChapterClearContentsRequest,
): Promise<ComicChapterClearContentsResponse> {
  return requestClient.post<ComicChapterClearContentsResponse>(
    '/api/admin/work/comic-chapter/clear-contents',
    params,
  );
}
