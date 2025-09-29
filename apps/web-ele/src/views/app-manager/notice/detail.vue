<script setup lang="ts">
import type { NoticeDetailResponse } from '#/apis/types/notice';

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

// 详情卡片配置
const detailCards = computed(() => [
  {
    title: '基本信息',
    show: true,
    fields: [
      {
        label: '通知标题',
        value: detail.value?.title,
        type: 'text',
      },
      {
        label: '通知类型',
        value: noticeTypeInfo.value?.label,
        type: 'colored-text',
        color: noticeTypeInfo.value?.color,
      },
      {
        label: '优先级',
        value: priorityInfo.value?.label,
        type: 'colored-text',
        color: priorityInfo.value?.color,
      },
      {
        label: '发布状态',
        value: publishStatusInfo.value?.label,
        type: 'colored-text',
        color: publishStatusInfo.value?.color,
      },
      {
        label: '发布平台',
        value: enablePlatformLabels.value || '-',
        type: 'text',
      },
      {
        label: '阅读次数',
        value: detail.value?.readCount || 0,
        type: 'text',
      },
      {
        label: '是否置顶',
        value: detail.value?.isPinned,
        type: 'tag',
        tagType: detail.value?.isPinned ? 'success' : 'info',
        tagText: detail.value?.isPinned ? '是' : '否',
      },
      {
        label: '首页弹窗',
        value: detail.value?.showAsPopup,
        type: 'tag',
        tagType: detail.value?.showAsPopup ? 'success' : 'info',
        tagText: detail.value?.showAsPopup ? '是' : '否',
      },
    ],
  },
  {
    title: '时间信息',
    show: true,
    fields: [
      {
        label: '发布开始时间',
        value: detail.value?.publishStartTime
          ? formatUTC(detail.value.publishStartTime, 'YYYY-MM-DD HH:mm:ss')
          : '-',
        type: 'text',
      },
      {
        label: '发布结束时间',
        value: detail.value?.publishEndTime
          ? formatUTC(detail.value.publishEndTime, 'YYYY-MM-DD HH:mm:ss')
          : '-',
        type: 'text',
      },
      {
        label: '创建时间',
        value: detail.value?.createdAt
          ? formatUTC(detail.value.createdAt, 'YYYY-MM-DD HH:mm:ss')
          : '-',
        type: 'text',
      },
      {
        label: '更新时间',
        value: detail.value?.updatedAt
          ? formatUTC(detail.value.updatedAt, 'YYYY-MM-DD HH:mm:ss')
          : '-',
        type: 'text',
      },
    ],
  },
  {
    title: '关联页面',
    show: !!(detail.value?.pageCode || detail.value?.clientPage),
    fields: [
      {
        label: '页面代码',
        value: detail.value?.pageCode,
        type: 'text',
        show: !!detail.value?.pageCode,
      },
      {
        label: '页面名称',
        value: detail.value?.clientPage?.pageName,
        type: 'text',
        show: !!detail.value?.clientPage?.pageName,
      },
      {
        label: '页面路径',
        value: detail.value?.clientPage?.pagePath,
        type: 'text',
        show: !!detail.value?.clientPage?.pagePath,
      },
    ].filter((field) => field.show !== false),
  },
  {
    title: '弹窗背景图',
    show: !!detail.value?.popupBackgroundImage,
    type: 'image',
    imageUrl: detail.value?.popupBackgroundImage,
  },
  {
    title: '通知内容',
    show: true,
    type: 'html',
    content: detail.value?.content,
  },
]);
</script>

<template>
  <Modal title="通知详情" class="!w-[800px]" v-if="detail">
    <div v-loading="loading" class="space-y-6">
      <!-- 动态渲染卡片 -->
      <template v-for="card in detailCards" :key="card.title">
        <el-card v-if="card.show" shadow="never">
          <template #header>
            <div class="flex items-center">
              <span class="text-lg font-medium">{{ card.title }}</span>
            </div>
          </template>

          <!-- 字段列表类型 -->
          <div v-if="card.fields" class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              v-for="field in card.fields"
              :key="field.label"
              class="flex items-center"
            >
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                {{ field.label }}：
              </label>

              <!-- 普通文本 -->
              <p
                v-if="field.type === 'text'"
                class="text-sm text-gray-900 dark:text-gray-100"
              >
                {{ field.value }}
              </p>

              <!-- 带颜色的文本 -->
              <el-text
                v-else-if="field.type === 'colored-text' && field.value"
                :style="{ color: 'color' in field ? field.color : undefined }"
              >
                {{ field.value }}
              </el-text>

              <!-- 标签 -->
              <el-tag
                v-else-if="
                  field.type === 'tag' && 'tagText' in field && field.tagText
                "
                :type="('tagType' in field && field.tagType) as any"
                size="small"
              >
                {{ 'tagText' in field ? field.tagText : '' }}
              </el-tag>
            </div>
          </div>

          <!-- 图片类型 -->
          <div
            v-else-if="card.type === 'image' && card.imageUrl"
            class="flex justify-center"
          >
            <el-image
              :src="card.imageUrl"
              :preview-src-list="[card.imageUrl]"
              class="max-h-60 max-w-full rounded-lg"
              fit="contain"
              preview-teleported
            />
          </div>

          <!-- HTML内容类型 -->
          <div
            v-else-if="card.type === 'html'"
            class="prose dark:prose-invert max-w-none"
            v-html="card.content"
          ></div>
        </el-card>
      </template>
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
