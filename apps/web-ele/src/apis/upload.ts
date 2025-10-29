import type {
  UploadUploadFileRequest,
  UploadUploadFileResponse,
} from './types/upload.d';

import { requestClient } from '#/utils/request';

/**
 * 上传文件
 */
export async function uploadUploadFileApi(
  params?: UploadUploadFileRequest,
): Promise<UploadUploadFileResponse> {
  return requestClient.post<UploadUploadFileResponse>(
    '/api/admin/upload/upload-file',
    params,
  );
}
