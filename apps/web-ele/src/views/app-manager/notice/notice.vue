<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';
import type {
  CreateNoticeDto,
  NoticePageResponseDto,
  UpdateNoticeDto,
} from '#/apis/types/notice';

import { Page, useVbenModal } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDeleteNoticeApi,
  batchUpdateNoticeStatusApi,
  clientPagePageApi,
  createNoticeApi,
  noticeDetailApi,
  noticePageApi,
  updateNoticeApi,
} from '#/apis';
import EsModalForm from '#/components/es-modal-form/index.vue';
import { useBitMask } from '#/hooks/useBitmask';
import { useMessage } from '#/hooks/useFeedback';
import { createSearchFormOptions } from '#/utils/grid-form-config';

import {
  enablePlatform,
  formSchema,
  getPublishStatus,
  noticeColumns,
  noticeFilter,
  noticePriorityObj,
  noticeTypeObj,
  publishStatusObj,
} from './shared';

const clientPageObj = ref<Record<string, string>>({});

clientPagePageApi({
  pageSize: 500,
}).then((res) => {
  const pageOptions =
    res.list?.map((pageItem) => {
      clientPageObj.value[pageItem.pageCode] = pageItem.pageName;
      return {
        label: pageItem.pageName,
        value: pageItem.pageCode,
        ...pageItem,
      };
    }) || [];

  noticeFilter.forEach((item) => {
    if (item.fieldName === 'pageCode' && item.componentProps) {
      (item.componentProps as any).options = pageOptions;
    }
  });
  formSchema.forEach((item) => {
    if (item.fieldName === 'pageCode' && item.componentProps) {
      (item.componentProps as any).options = pageOptions;
    }
  });

  gridApi.formApi.updateSchema(noticeFilter);
});

const gridOptions: VxeGridProps<NoticePageResponseDto> = {
  columns: noticeColumns,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        return await noticePageApi({
          pageIndex: --page.currentPage,
          pageSize: page.pageSize,
          ...formValues,
        });
      },
    },
    sort: true,
  },

  toolbarConfig: {
    custom: true,
    export: true,
    refresh: true,
    zoom: true,
  },
};

const [Form, formApi] = useVbenModal({
  connectedComponent: EsModalForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: createSearchFormOptions(noticeFilter),
  gridOptions,
});

async function openFormModal(row?: NoticePageResponseDto) {
  let record;
  if (row) {
    record = await noticeDetailApi({ id: row.id });
    record.dateTimeRange = [record.publishStartTime, record.publishEndTime];
  }
  formApi
    .setData({ title: '通知公告', record, bitMaskField: ['enablePlatform'] })
    .open();
}

async function handleSubmit(values: CreateNoticeDto | UpdateNoticeDto) {
  await (values?.id
    ? updateNoticeApi(values as UpdateNoticeDto)
    : createNoticeApi(values as CreateNoticeDto));
  formApi.close();
  useMessage.success('操作成功');
  gridApi.reload();
}

async function deleteNotice(record: NoticePageResponseDto) {
  await batchDeleteNoticeApi({ ids: [record.id] });
  useMessage.success('操作成功');
  gridApi.reload();
}

async function togglePublishStatus(record: NoticePageResponseDto) {
  const newStatus = !record.isPublished;
  await batchUpdateNoticeStatusApi({
    ids: [record.id],
    isPublished: newStatus,
  });
  useMessage.success(newStatus ? '发布成功' : '取消发布成功');
  gridApi.reload();
}

function getPublishButtonText(record: NoticePageResponseDto): string {
  const status = getPublishStatus(record.isPublished, record.publishEndTime);

  if (status === 'unpublished') {
    return '发布';
  } else if (status === 'published') {
    return '取消发布';
  } else {
    return '重新发布';
  }
}

function canPublish(record: NoticePageResponseDto): boolean {
  const status = getPublishStatus(record.isPublished, record.publishEndTime);
  return status !== 'expired';
}
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #toolbar-actions>
        <el-button class="ml-2" type="primary" @click="openFormModal()">
          添加
        </el-button>
      </template>
      <template #noticeType="{ row }">
        <el-text :style="{ color: noticeTypeObj[row.noticeType]?.color }">
          {{ noticeTypeObj[row.noticeType]?.label }}
        </el-text>
      </template>
      <template #priorityLevel="{ row }">
        <el-text
          :style="{ color: noticePriorityObj[row.priorityLevel]?.color }"
        >
          {{ noticePriorityObj[row.priorityLevel]?.label }}
        </el-text>
      </template>
      <template #pageCode="{ row }">
        <el-text>
          {{ row.pageCode ? clientPageObj[row.pageCode] : '-' }}
        </el-text>
      </template>
      <template #enablePlatform="{ row }">
        <el-text>
          {{
            useBitMask.getLabels(row.enablePlatform, enablePlatform).join('、')
          }}
        </el-text>
      </template>

      <template #publishStatus="{ row }">
        <el-text
          :style="{
            color:
              publishStatusObj[
                getPublishStatus(row.isPublished, row.publishEndTime)
              ]?.color,
          }"
        >
          {{
            publishStatusObj[
              getPublishStatus(row.isPublished, row.publishEndTime)
            ]?.label
          }}
        </el-text>
      </template>
      <template #actions="{ row }">
        <div class="my-1">
          <el-button size="small" type="link" @click="openFormModal(row)">
            编辑
          </el-button>

          <el-divider type="vertical" />
          <el-popconfirm
            v-if="canPublish(row)"
            :title="
              row.isPublished ? '确认取消发布当前通知?' : '确认发布当前通知?'
            "
            ok-text="确认"
            cancel-text="取消"
            @confirm="togglePublishStatus(row)"
          >
            <el-button
              size="small"
              type="link"
              :style="{
                color: canPublish(row) ? '#1890ff' : '#ff4d4f',
              }"
            >
              {{ getPublishButtonText(row) }}
            </el-button>
          </el-popconfirm>
          <el-button
            v-else
            size="small"
            type="link"
            disabled
            :style="{
              color: '#d9d9d9',
            }"
          >
            {{ getPublishButtonText(row) }}
          </el-button>
          <el-divider type="vertical" />
          <el-popconfirm
            title="确认删除当前项?"
            ok-text="确认"
            cancel-text="取消"
            @confirm="deleteNotice(row)"
          >
            <el-button type="link" danger>删除</el-button>
          </el-popconfirm>
        </div>
      </template>
    </Grid>

    <Form
      :schema="formSchema"
      :field-mapping-time="[
        ['dateTimeRange', ['publishStartTime', 'publishEndTime']],
      ]"
      :on-submit="handleSubmit"
    />
  </Page>
</template>
