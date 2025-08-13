import type {
  RequestLogDetailRequest,
  RequestLogDetailResponse,
  RequestLogPageRequest,
  RequestLogPageResponse,
} from './types/requestLog.d';

import { requestClient } from '#/utils/request';

/**
 * 分页查询请求日志
 */
export async function requestLogPageApi(
  params: RequestLogPageRequest,
): Promise<RequestLogPageResponse> {
  return requestClient.get<RequestLogPageResponse>(
    '/api/admin/request-log/request-log-page',
    { params },
  );
}

/**
 * 查询请求日志详情
 */
export async function requestLogDetailApi(
  params: RequestLogDetailRequest,
): Promise<RequestLogDetailResponse> {
  return requestClient.get<RequestLogDetailResponse>(
    '/api/admin/request-log/request-log-detail',
    { params },
  );
}
