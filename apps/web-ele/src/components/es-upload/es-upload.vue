<script setup lang="ts">
// 使用 Element Plus 的类型与组件 API
import type {
  UploadFile,
  UploadProps,
  UploadRawFile,
  UploadRequestOptions,
} from 'element-plus';

import type { EsUploadProps } from '#/components/es-upload/types';

import { ElMessage } from 'element-plus';
import { cloneDeep, random } from 'lodash-es';

import { UploadLoop } from '#/components/es-icons';
import { useUpload } from '#/hooks/useUpload';
import { safeParseJson } from '#/utils/parseJson';

defineOptions({
  name: 'EsUpload',
});
const props = withDefaults(defineProps<EsUploadProps>(), {
  accept: 'image/*',
  maxCount: 10,
  listType: 'picture-card',
  multiple: true,
  maxSize: 200 * 1024 * 1024, // 默认200MB，单位为字节
  autoUpload: true,
  showProgress: true,
  modelValue: () => [],
  returnDataType: 'url',
});
const emit = defineEmits<{
  (e: 'update:modelValue', val: EsUploadProps['modelValue']): void;
}>();
// 绑定到 el-upload 的文件列表（Element Plus UploadFile 类型）
const fileList = ref<UploadFile[]>([]);

// 固定读取初始化时的返回数据类型，保持与原逻辑一致
const fileListDataType: EsUploadProps['returnDataType'] = props.returnDataType;

/**
 * 根据外部 v-model 值构造内部 fileList
 * 支持：字符串(url/JSON)、数组(对象/字符串)
 */
function formatFileList(files: EsUploadProps['modelValue']) {
  if (Array.isArray(files)) {
    files.forEach((file) => {
      if (typeof file === 'string') {
        formatFileList(file);
      } else {
        fileList.value.push({
          uid: random(1000, 9999),
          size: file.fileSize,
          name: file.originalName,
          url: file.filePath,
          status: 'success',
          response: cloneDeep(file),
        } as UploadFile);
      }
    });
  } else {
    const json = safeParseJson(files);
    if (json) {
      formatFileList(json as any);
    } else if (typeof files === 'string') {
      const fileName = files.split('/').pop();
      fileList.value.push({
        uid: random(1000, 9999),
        size: 0,
        name: fileName ?? '',
        url: files,
        status: 'success',
        response: { filePath: files },
      } as UploadFile);
    }
  }
}

// 防止我们主动更新 v-model 后 watch 重复重建列表
let skipModalValueWatch = false;
watch(
  () => props.modelValue,
  (val) => {
    if (skipModalValueWatch) {
      skipModalValueWatch = false;
      return;
    }
    fileList.value = [];
    formatFileList(val);
  },
  { immediate: true, deep: true },
);

/**
 * 上传前校验
 * - 大小限制
 * - 数量限制（结合 limit 与 exceed 提示）
 */
function beforeUpload(raw: UploadRawFile): boolean {
  if ((raw?.size ?? Number.MAX_VALUE) > props.maxSize) {
    ElMessage.error(`文件 ${raw.name} 大小超出限制`);
    return false;
  }
  if (fileList.value.length >= props.maxCount) {
    ElMessage.error('文件超出数量限制');
    return false;
  }
  return true;
}

/**
 * 将内部 fileList 转换为 v-model 指定的数据格式
 * - url: 以逗号分隔的 url 字符串
 * - array: url 字符串数组
 * - json: 完整响应对象数组的 JSON 字符串
 */
function handlerModalValue() {
  if (!Array.isArray(fileList.value) || fileList.value.length === 0) {
    emit('update:modelValue', [] as any);
    return;
  }

  let data: any;
  if (fileListDataType === 'url') {
    data = fileList.value.map((item: any) => item.response?.filePath).join(',');
  } else if (fileListDataType === 'array') {
    data = fileList.value.map((item: any) => item.response?.filePath);
  } else {
    data = JSON.stringify(fileList.value.map((item: any) => item.response));
  }

  emit('update:modelValue', data);
}

/**
 * 自定义上传流程，使用内部 useUpload 封装
 * 与 Element Plus 的 http-request 适配
 */
async function customRequest(options: UploadRequestOptions) {
  // 初始化进度
  options.onProgress?.({ percent: 0 } as any);

  const { success, error } = await useUpload(
    // 将当前文件传入后端上传逻辑
    options.file as any,
    options.data ?? {},
    'common',
    // 进度回调：转给 Element Plus
    (progressEvent) => {
      options.onProgress?.({ percent: progressEvent.percent } as any);
    },
  );

  if (error?.length) {
    // 统一错误提示
    ElMessage.error(error[0]?.message ?? '上传失败');
    options.onError?.(new Error(error[0]?.message ?? 'upload error') as any);
    return;
  }

  // 通知 Element Plus 上传成功，自动写入 file.response/status
  options.onSuccess?.(success[0] as any);
  skipModalValueWatch = true;
  handlerModalValue();
}

// 超出数量时的提示（Element Plus 触发 exceed）
function onExceed() {
  ElMessage.error(`最多只能上传 ${props.maxCount} 个文件`);
}

// 删除文件后同步外部 v-model（保持行为直观，不改变原有成功回写逻辑）
function onRemove() {
  skipModalValueWatch = true;
  handlerModalValue();
}

const showPreview = ref(false);
const previewIndex = ref(0);
const handlePictureCardPreview: UploadProps['onPreview'] = (uploadFile) => {
  previewIndex.value = fileList.value.indexOf(uploadFile);
  showPreview.value = true;
};
</script>

<template>
  <div>
    <el-upload
      v-model:file-list="fileList"
      :accept="accept"
      :limit="maxCount"
      :list-type="listType"
      :multiple="multiple"
      :data="data"
      :disabled="disabled"
      :name="name"
      :auto-upload="autoUpload"
      :before-upload="beforeUpload"
      :http-request="customRequest"
      @exceed="onExceed"
      @remove="onRemove"
      :on-preview="handlePictureCardPreview"
    >
      <div
        class="hover:text-primary flex size-full items-center justify-center text-gray-500"
      >
        <UploadLoop class="size-7" />
      </div>
    </el-upload>

    <el-image-viewer
      v-if="showPreview"
      :url-list="fileList.map((item) => item.url) as string[]"
      show-progress
      teleported
      :z-index="999999999"
      :close-on-press-escape="false"
      :initial-index="previewIndex"
      @close="showPreview = false"
    />
  </div>
</template>

<style scoped lang="scss">
::v-deep(.el-upload--picture-card) {
  width: 100px;
  height: 100px;
}

::v-deep(.el-upload-list--picture-card) {
  .el-upload-list__item {
    width: 100px;
    height: 100px;
  }
}
</style>
