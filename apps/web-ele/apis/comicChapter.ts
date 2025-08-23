import type {
  AddChapterContentRequest,
  AddChapterContentResponse,
  BatchDeleteComicChapterRequest,
  BatchDeleteComicChapterResponse,
  BatchUpdateChapterContentsRequest,
  BatchUpdateChapterContentsResponse,
  BatchUpdateChapterPublishStatusRequest,
  BatchUpdateChapterPublishStatusResponse,
  ChapterContentsRequest,
  ChapterContentsResponse,
  ClearChapterContentsRequest,
  ClearChapterContentsResponse,
  ComicChapterDetailRequest,
  ComicChapterDetailResponse,
  ComicChapterPageRequest,
  ComicChapterPageResponse,
  CreateComicChapterRequest,
  CreateComicChapterResponse,
  DeleteChapterContentRequest,
  DeleteChapterContentResponse,
  MoveChapterContentRequest,
  MoveChapterContentResponse,
  SwapChapterNumbersRequest,
  SwapChapterNumbersResponse,
  UpdateChapterContentRequest,
  UpdateChapterContentResponse,
  UpdateComicChapterRequest,
  UpdateComicChapterResponse,
} from './types/comicChapter.d';

import { requestClient } from '#/utils/request';

/**
 * 创建漫画章节
 */
export async function createComicChapterApi(
  params: CreateComicChapterRequest,
): Promise<CreateComicChapterResponse> {
  return requestClient.post<CreateComicChapterResponse>(
    '/api/admin/work/comic-chapter/create-comic-chapter',
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
    '/api/admin/work/comic-chapter/comic-chapter-page',
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
    '/api/admin/work/comic-chapter/comic-chapter-detail',
    { params },
  );
}

/**
 * 更新漫画章节信息
 */
export async function updateComicChapterApi(
  params: UpdateComicChapterRequest,
): Promise<UpdateComicChapterResponse> {
  return requestClient.post<UpdateComicChapterResponse>(
    '/api/admin/work/comic-chapter/update-comic-chapter',
    params,
  );
}

/**
 * 批量更新章节发布状态
 */
export async function batchUpdateChapterPublishStatusApi(
  params: BatchUpdateChapterPublishStatusRequest,
): Promise<BatchUpdateChapterPublishStatusResponse> {
  return requestClient.post<BatchUpdateChapterPublishStatusResponse>(
    '/api/admin/work/comic-chapter/batch-update-chapter-publish-status',
    params,
  );
}

/**
 * 批量软删除章节
 */
export async function batchDeleteComicChapterApi(
  params: BatchDeleteComicChapterRequest,
): Promise<BatchDeleteComicChapterResponse> {
  return requestClient.post<BatchDeleteComicChapterResponse>(
    '/api/admin/work/comic-chapter/batch-delete-comic-chapter',
    params,
  );
}

/**
 * 交换两个章节的章节号
 */
export async function swapChapterNumbersApi(
  params: SwapChapterNumbersRequest,
): Promise<SwapChapterNumbersResponse> {
  return requestClient.post<SwapChapterNumbersResponse>(
    '/api/admin/work/comic-chapter/swap-chapter-numbers',
    params,
  );
}

/**
 * 获取章节内容详情
 */
export async function chapterContentsApi(
  params: ChapterContentsRequest,
): Promise<ChapterContentsResponse> {
  return requestClient.get<ChapterContentsResponse>(
    '/api/admin/work/comic-chapter/chapter-contents',
    { params },
  );
}

/**
 * 添加章节内容
 */
export async function addChapterContentApi(
  params: AddChapterContentRequest,
): Promise<AddChapterContentResponse> {
  return requestClient.post<AddChapterContentResponse>(
    '/api/admin/work/comic-chapter/add-chapter-content',
    params,
  );
}

/**
 * 更新章节内容
 */
export async function updateChapterContentApi(
  params: UpdateChapterContentRequest,
): Promise<UpdateChapterContentResponse> {
  return requestClient.post<UpdateChapterContentResponse>(
    '/api/admin/work/comic-chapter/update-chapter-content',
    params,
  );
}

/**
 * 删除章节内容
 */
export async function deleteChapterContentApi(
  params: DeleteChapterContentRequest,
): Promise<DeleteChapterContentResponse> {
  return requestClient.post<DeleteChapterContentResponse>(
    '/api/admin/work/comic-chapter/delete-chapter-content',
    params,
  );
}

/**
 * 移动章节内容（排序）
 */
export async function moveChapterContentApi(
  params: MoveChapterContentRequest,
): Promise<MoveChapterContentResponse> {
  return requestClient.post<MoveChapterContentResponse>(
    '/api/admin/work/comic-chapter/move-chapter-content',
    params,
  );
}

/**
 * 批量更新章节内容
 */
export async function batchUpdateChapterContentsApi(
  params: BatchUpdateChapterContentsRequest,
): Promise<BatchUpdateChapterContentsResponse> {
  return requestClient.post<BatchUpdateChapterContentsResponse>(
    '/api/admin/work/comic-chapter/batch-update-chapter-contents',
    params,
  );
}

/**
 * 清空章节内容
 */
export async function clearChapterContentsApi(
  params: ClearChapterContentsRequest,
): Promise<ClearChapterContentsResponse> {
  return requestClient.post<ClearChapterContentsResponse>(
    '/api/admin/work/comic-chapter/clear-chapter-contents',
    params,
  );
}
