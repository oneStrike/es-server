import { requestClient } from '#/utils/request';
import type {
  UploadUploadFileRequest,
  UploadUploadFileResponse,
  UploadResponseDto,
} from './types/upload.d';

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
