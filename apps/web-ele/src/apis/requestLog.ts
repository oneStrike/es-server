import { requestClient } from '#/utils/request';
import type {
  RequestLogPageRequest,
  RequestLogPageResponse,
  RequestLogDto,
} from './types/requestLog.d';

/**
 * 分页获取请求日志列表
 */
export async function requestLogPageApi(
  params?: RequestLogPageRequest,
): Promise<RequestLogPageResponse> {
  return requestClient.get<RequestLogPageResponse>(
    '/api/admin/request-log/request-log-page',
    { params },
  );
}
