<script setup lang="ts">
import type { ClientPageConfigPageResponseDto } from '#/apis/types/clientPage';

import { computed } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { clientPageDetailByIdApi } from '#/apis';
import { formatUTC } from '#/utils';

import { accessLevelObj } from './shared';

defineOptions({ name: 'PageDetail' });

const [Modal, modalApi] = useVbenModal({
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      getDetail();
    }
  },
});

const detail = ref<ClientPageConfigPageResponseDto>();
const loading = ref(false);

async function getDetail() {
  try {
    loading.value = true;
    const { recordId } = modalApi.getData<{ recordId: number }>();
    detail.value = await clientPageDetailByIdApi({ id: recordId });
  } finally {
    loading.value = false;
  }
}

// 计算属性
const accessLevelInfo = computed(() => {
  if (!detail.value) return null;
  return accessLevelObj[detail.value.accessLevel];
});

// 详情卡片配置
const detailCards = computed(() => [
  {
    title: '基本信息',
    show: true,
    fields: [
      {
        label: '页面名称',
        value: detail.value?.pageName,
        type: 'text',
      },
      {
        label: '页面路径',
        value: detail.value?.pagePath,
        type: 'text',
      },
      {
        label: '页面代码',
        value: detail.value?.pageCode,
        type: 'text',
      },
      {
        label: '权限级别',
        value: accessLevelInfo.value?.label,
        type: 'colored-text',
        color: accessLevelInfo.value?.color,
      },
      {
        label: '页面状态',
        value: detail.value?.isEnabled ? '启用' : '禁用',
        type: 'text',
      },
      {
        label: '页面描述',
        value: detail.value?.pageDescription || '-',
        type: 'text',
      },
      {
        label: '页面标题',
        value: detail.value?.pageTitle || '-',
        type: 'text',
      },
      {
        label: '页面关键词',
        value: detail.value?.pageKeywords || '-',
        type: 'text',
      },
    ],
  },
  {
    title: '时间信息',
    show: true,
    fields: [
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
    title: '页面配置',
    show: !!detail.value?.pageConfig,
    type: 'json',
    content: detail.value?.pageConfig,
  },
]);
</script>

<template>
  <Modal title="页面详情" class="!w-[800px]" v-if="detail">
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
            </div>
          </div>

          <!-- JSON配置类型 -->
          <div
            v-else-if="card.type === 'json' && card.content"
            class="space-y-4"
          >
            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                配置内容
              </label>
              <div class="mt-2">
                <el-input
                  :model-value="JSON.stringify(card.content, null, 2)"
                  type="textarea"
                  :rows="10"
                  readonly
                  class="font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </el-card>
      </template>
    </div>
  </Modal>
</template>
