<script setup lang="ts">
import type { ClientPageConfigPageResponseDto } from '#/apis/types/clientPage';

import { computed } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { clientPageDetailByIdApi } from '#/apis';
import { formatUTC } from '#/utils';

import { accessLevelObj, pageStatusObj } from './shared';

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

const pageStatusInfo = computed(() => {
  if (!detail.value) return null;
  return pageStatusObj[detail.value.pageStatus];
});
</script>

<template>
  <Modal title="页面详情" class="!w-[800px]" v-if="detail">
    <div v-loading="loading" class="space-y-6">
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
                页面名称
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ detail.pageName }}
              </p>
            </div>

            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                页面路径
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ detail.pagePath }}
              </p>
            </div>

            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                页面代码
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ detail.pageCode }}
              </p>
            </div>

            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                权限级别
              </label>
              <p class="mt-1">
                <el-text
                  v-if="accessLevelInfo"
                  :style="{ color: accessLevelInfo.color }"
                >
                  {{ accessLevelInfo.label }}
                </el-text>
              </p>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                页面状态
              </label>
              <p class="mt-1">
                <el-text
                  v-if="pageStatusInfo"
                  :style="{ color: pageStatusInfo.color }"
                >
                  {{ pageStatusInfo.label }}
                </el-text>
              </p>
            </div>

            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                页面描述
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ detail.pageDescription || '-' }}
              </p>
            </div>

            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                页面标题
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ detail.pageTitle || '-' }}
              </p>
            </div>

            <div>
              <label
                class="text-sm font-medium text-gray-600 dark:text-gray-300"
              >
                页面关键词
              </label>
              <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {{ detail.pageKeywords || '-' }}
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
            <label class="text-sm font-medium text-gray-600 dark:text-gray-300">
              创建时间
            </label>
            <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {{ formatUTC(detail.createdAt, 'YYYY-MM-DD HH:mm:ss') }}
            </p>
          </div>

          <div>
            <label class="text-sm font-medium text-gray-600 dark:text-gray-300">
              更新时间
            </label>
            <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
              {{ formatUTC(detail.updatedAt, 'YYYY-MM-DD HH:mm:ss') }}
            </p>
          </div>
        </div>
      </el-card>

      <!-- 页面配置 -->
      <el-card v-if="detail.pageConfig" shadow="never">
        <template #header>
          <div class="flex items-center">
            <span class="text-lg font-medium">页面配置</span>
          </div>
        </template>

        <div class="space-y-4">
          <div>
            <label class="text-sm font-medium text-gray-600 dark:text-gray-300">
              配置内容
            </label>
            <div class="mt-2">
              <el-input
                :model-value="JSON.stringify(detail.pageConfig, null, 2)"
                type="textarea"
                :rows="10"
                readonly
                class="font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </Modal>
</template>
