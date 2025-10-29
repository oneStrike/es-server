import type {
  NoticeBatchDeleteRequest,
  NoticeBatchDeleteResponse,
  NoticeBatchUpdateStatusRequest,
  NoticeBatchUpdateStatusResponse,
  NoticeCreateRequest,
  NoticeCreateResponse,
  NoticeDetailRequest,
  NoticeDetailResponse,
  NoticePageRequest,
  NoticePageResponse,
  NoticeUpdateRequest,
  NoticeUpdateResponse,
} from './types/notice.d';

import { requestClient } from '#/utils/request';

/**
 * 创建通知消息
 */
export async function noticeCreateApi(
  params: NoticeCreateRequest,
): Promise<NoticeCreateResponse> {
  return requestClient.post<NoticeCreateResponse>(
    '/api/admin/notice/create',
    params,
  );
}

/**
 * 分页查询通知列表
 */
export async function noticePageApi(
  params?: NoticePageRequest,
): Promise<NoticePageResponse> {
  return requestClient.get<NoticePageResponse>('/api/admin/notice/page', {
    params,
  });
}

/**
 * 根据ID查询通知详情
 */
export async function noticeDetailApi(
  params: NoticeDetailRequest,
): Promise<NoticeDetailResponse> {
  return requestClient.get<NoticeDetailResponse>('/api/admin/notice/detail', {
    params,
  });
}

/**
 * 更新通知消息
 */
export async function noticeUpdateApi(
  params: NoticeUpdateRequest,
): Promise<NoticeUpdateResponse> {
  return requestClient.post<NoticeUpdateResponse>(
    '/api/admin/notice/update',
    params,
  );
}

/**
 * 批量更新通知状态
 */
export async function noticeBatchUpdateStatusApi(
  params: NoticeBatchUpdateStatusRequest,
): Promise<NoticeBatchUpdateStatusResponse> {
  return requestClient.post<NoticeBatchUpdateStatusResponse>(
    '/api/admin/notice/batch-update-status',
    params,
  );
}

/**
 * 批量删除通知
 */
export async function noticeBatchDeleteApi(
  params: NoticeBatchDeleteRequest,
): Promise<NoticeBatchDeleteResponse> {
  return requestClient.post<NoticeBatchDeleteResponse>(
    '/api/admin/notice/batch-delete',
    params,
  );
}
