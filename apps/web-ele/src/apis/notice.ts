import type {
  BatchDeleteNoticeRequest,
  BatchDeleteNoticeResponse,
  BatchUpdateNoticeStatusRequest,
  BatchUpdateNoticeStatusResponse,
  CreateNoticeRequest,
  CreateNoticeResponse,
  NoticeDetailRequest,
  NoticeDetailResponse,
  NoticePageRequest,
  NoticePageResponse,
  UpdateNoticeRequest,
  UpdateNoticeResponse,
} from './types/notice.d';

import { requestClient } from '#/utils/request';

/**
 * 创建通知消息
 */
export async function createNoticeApi(
  params: CreateNoticeRequest,
): Promise<CreateNoticeResponse> {
  return requestClient.post<CreateNoticeResponse>(
    '/api/admin/notice/create-notice',
    params,
  );
}

/**
 * 分页查询通知列表
 */
export async function noticePageApi(
  params?: NoticePageRequest,
): Promise<NoticePageResponse> {
  return requestClient.get<NoticePageResponse>(
    '/api/admin/notice/notice-page',
    { params },
  );
}

/**
 * 根据ID查询通知详情
 */
export async function noticeDetailApi(
  params: NoticeDetailRequest,
): Promise<NoticeDetailResponse> {
  return requestClient.get<NoticeDetailResponse>(
    '/api/admin/notice/notice-detail',
    { params },
  );
}

/**
 * 更新通知消息
 */
export async function updateNoticeApi(
  params: UpdateNoticeRequest,
): Promise<UpdateNoticeResponse> {
  return requestClient.post<UpdateNoticeResponse>(
    '/api/admin/notice/update-notice',
    params,
  );
}

/**
 * 批量更新通知状态
 */
export async function batchUpdateNoticeStatusApi(
  params: BatchUpdateNoticeStatusRequest,
): Promise<BatchUpdateNoticeStatusResponse> {
  return requestClient.post<BatchUpdateNoticeStatusResponse>(
    '/api/admin/notice/batch-update-notice-status',
    params,
  );
}

/**
 * 批量删除通知
 */
export async function batchDeleteNoticeApi(
  params: BatchDeleteNoticeRequest,
): Promise<BatchDeleteNoticeResponse> {
  return requestClient.post<BatchDeleteNoticeResponse>(
    '/api/admin/notice/batch-delete-notice',
    params,
  );
}
