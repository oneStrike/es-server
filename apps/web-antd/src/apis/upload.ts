import type { UploadFileRequest, UploadFileResponse } from './types/upload.d';

import { requestClient } from '#/utils/request';

/**
 * 上传文件
 */
export async function uploadFileApi(
  params: UploadFileRequest,
): Promise<UploadFileResponse> {
  return requestClient.post<UploadFileResponse>(
    '/api/admin/upload/upload-file',
    params,
  );
}
