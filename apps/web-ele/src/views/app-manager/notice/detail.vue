<script setup lang="ts">
import type { NoticeDetailResponse } from '#/apis/types/notice';

import { computed } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { noticeDetailApi } from '#/apis';
import { useBitMask } from '#/hooks/useBitmask';
import { formatUTC } from '#/utils';

import {
  enablePlatform,
  getPublishStatus,
  noticePriorityObj,
  noticeTypeObj,
  publishStatusObj,
} from './shared';

defineOptions({ name: 'NoticeDetail' });

const [Modal, modalApi] = useVbenModal({
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      getDetail();
    }
  },
});

const detail = ref<NoticeDetailResponse>();
const loading = ref(false);

async function getDetail() {
  try {
    loading.value = true;
    const { recordId } = modalApi.getData<{ recordId: number }>();
    detail.value = await noticeDetailApi({ id: recordId });
  } finally {
    loading.value = false;
  }
}

// 计算属性
const publishStatus = computed(() => {
  if (!detail.value) return '';
  return getPublishStatus(
    detail.value.isPublished,
    detail.value.publishEndTime,
  );
});

const enablePlatformLabels = computed(() => {
  if (!detail.value) return '';
  return useBitMask
    .getLabels(detail.value.enablePlatform, enablePlatform)
    .join('、');
});

const noticeTypeInfo = computed(() => {
  if (!detail.value) return null;
  return noticeTypeObj[detail.value.noticeType];
});

const priorityInfo = computed(() => {
  if (!detail.value) return null;
  return noticePriorityObj[detail.value.priorityLevel];
});

const publishStatusInfo = computed(() => {
  return publishStatusObj[publishStatus.value];
});
</script>

<template>
  <Modal title="通知详情" class="!w-[800px]">
    <div v-loading="loading" class="space-y-6">
      <template v-if="detail">
        <!-- 基本信息 -->
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center">
              <span class="text-lg font-medium">基本信息</span>
            </div>
          </template>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="space-y-3">
              <div>
                <label
                  class="text-sm font-medium text-gray-600 dark:text-gray-300"
                >
                  通知标题
                </label>
                <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {{ detail.title }}
                </p>
              </div>

              <div>
                <label
                  class="text-sm font-medium text-gray-600 dark:text-gray-300"
                  >通知类型
                </label>
                <p class="mt-1">
                  <el-text
                    v-if="noticeTypeInfo"
                    :style="{ color: noticeTypeInfo.color }"
                  >
                    {{ noticeTypeInfo.label }}
                  </el-text>
                </p>
              </div>

              <div>
                <label
                  class="text-sm font-medium text-gray-600 dark:text-gray-300"
                >
                  优先级
                </label>
                <p class="mt-1">
                  <el-text
                    v-if="priorityInfo"
                    :style="{ color: priorityInfo.color }"
                  >
                    {{ priorityInfo.label }}
                  </el-text>
                </p>
              </div>

              <div>
                <label
                  class="text-sm font-medium text-gray-600 dark:text-gray-300"
                  >发布状态
                </label>
                <p class="mt-1">
                  <el-text
                    v-if="publishStatusInfo"
                    :style="{ color: publishStatusInfo.color }"
                  >
                    {{ publishStatusInfo.label }}
                  </el-text>
                </p>
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <label
                  class="text-sm font-medium text-gray-600 dark:text-gray-300"
                  >发布平台
                </label>
                <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {{ enablePlatformLabels || '-' }}
                </p>
              </div>

              <div>
                <label
                  class="text-sm font-medium text-gray-600 dark:text-gray-300"
                  >是否置顶
                </label>
                <p class="mt-1">
                  <el-tag
                    :type="detail.isPinned ? 'success' : 'info'"
                    size="small"
                  >
                    {{ detail.isPinned ? '是' : '否' }}
                  </el-tag>
                </p>
              </div>

              <div>
                <label
                  class="text-sm font-medium text-gray-600 dark:text-gray-300"
                  >首页弹窗
                </label>
                <p class="mt-1">
                  <el-tag
                    :type="detail.showAsPopup ? 'success' : 'info'"
                    size="small"
                  >
                    {{ detail.showAsPopup ? '是' : '否' }}
                  </el-tag>
                </p>
              </div>

              <div>
                <label
                  class="text-sm font-medium text-gray-600 dark:text-gray-300"
                  >阅读次数
                </label>
                <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {{ detail.readCount || 0 }}
                </p>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 时间信息 -->
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center">
              <span class="text-lg font-medium">时间信息</span>
            </div>
          </template>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
                >发布开始时间
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{
                  detail.publishStartTime
                    ? formatUTC(detail.publishStartTime, 'YYYY-MM-DD HH:mm:ss')
                    : '-'
                }}
              </p>
            </div>

            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
                >发布结束时间
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{
                  detail.publishEndTime
                    ? formatUTC(detail.publishEndTime, 'YYYY-MM-DD HH:mm:ss')
                    : '-'
                }}
              </p>
            </div>

            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
                >创建时间
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ formatUTC(detail.createdAt, 'YYYY-MM-DD HH:mm:ss') }}
              </p>
            </div>

            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
                >更新时间
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ formatUTC(detail.updatedAt, 'YYYY-MM-DD HH:mm:ss') }}
              </p>
            </div>
          </div>
        </el-card>

        <!-- 关联页面信息 -->
        <el-card v-if="detail.pageCode || detail.clientPage" shadow="never">
          <template #header>
            <div class="flex items-center">
              <span class="text-lg font-medium">关联页面</span>
            </div>
          </template>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div v-if="detail.pageCode">
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
                >页面代码
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ detail.pageCode }}
              </p>
            </div>

            <div v-if="detail.clientPage?.pageName">
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
                >页面名称
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ detail.clientPage.pageName }}
              </p>
            </div>

            <div v-if="detail.clientPage?.pagePath">
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
                >页面路径
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ detail.clientPage.pagePath }}
              </p>
            </div>
          </div>
        </el-card>

        <!-- 弹窗背景图 -->
        <el-card v-if="detail.popupBackgroundImage" shadow="never">
          <template #header>
            <div class="flex items-center">
              <span class="text-lg font-medium">弹窗背景图</span>
            </div>
          </template>

          <div class="flex justify-center">
            <el-image
              :src="detail.popupBackgroundImage"
              :preview-src-list="[detail.popupBackgroundImage]"
              class="max-h-60 max-w-full rounded-lg"
              fit="contain"
              preview-teleported
            />
          </div>
        </el-card>

        <!-- 通知内容 -->
        <el-card shadow="never">
          <template #header>
            <div class="flex items-center">
              <span class="text-lg font-medium">通知内容</span>
            </div>
          </template>

          <div
            class="prose dark:prose-invert max-w-none"
            v-html="detail.content"
          ></div>
        </el-card>
      </template>

      <div v-else-if="!loading" class="flex items-center justify-center py-12">
        <el-empty description="暂无数据" />
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.prose {
  @apply text-gray-900 dark:text-gray-100;
}

.prose :deep(h1),
.prose :deep(h2),
.prose :deep(h3),
.prose :deep(h4),
.prose :deep(h5),
.prose :deep(h6) {
  @apply text-gray-900 dark:text-gray-100;
}

.prose :deep(p) {
  @apply text-gray-700 dark:text-gray-300;
}

.prose :deep(a) {
  @apply text-blue-600 dark:text-blue-400;
}

.prose :deep(blockquote) {
  @apply border-l-gray-300 text-gray-600 dark:border-l-gray-600 dark:text-gray-400;
}

.prose :deep(code) {
  @apply bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100;
}

.prose :deep(pre) {
  @apply bg-gray-100 dark:bg-gray-800;
}

.prose :deep(table) {
  @apply border-gray-300 dark:border-gray-600;
}

.prose :deep(th),
.prose :deep(td) {
  @apply border-gray-300 dark:border-gray-600;
}

.prose :deep(th) {
  @apply bg-gray-50 dark:bg-gray-800;
}
</style>
