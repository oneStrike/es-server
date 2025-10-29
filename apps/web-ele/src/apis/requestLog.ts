import type {
  RequestLogPageRequest,
  RequestLogPageResponse,
} from './types/requestLog.d';

import { requestClient } from '#/utils/request';

/**
 * 分页获取请求日志列表
 */
export async function requestLogPageApi(
  params?: RequestLogPageRequest,
): Promise<RequestLogPageResponse> {
  return requestClient.get<RequestLogPageResponse>(
    '/api/admin/request-log/page',
    { params },
  );
}
