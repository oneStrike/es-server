import type {
  RequestLogDetailRequest,
  RequestLogDetailResponse,
  RequestLogPageRequest,
  RequestLogPageResponse,
} from './types/requestLog.d';

import { requestClient } from '#/utils/request';

/**
 * 获取请求日志列表
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
 * 获取请求日志详情
 */
export async function requestLogDetailApi(
  params: RequestLogDetailRequest,
): Promise<RequestLogDetailResponse> {
  return requestClient.get<RequestLogDetailResponse>(
    '/api/admin/request-log/request-log-detail',
    { params },
  );
}
