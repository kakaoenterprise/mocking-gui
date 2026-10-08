<script setup lang="ts">
import { computed } from 'vue';
import { useData } from 'vitepress';

/**
 * Where this page sits, said the way the product says it.
 *
 * The panel names a row by its group and its place in the list, so a page does
 * the same: the section on the left, the position within it on the right. It
 * deliberately does not repeat the page title — the h1 is directly underneath.
 */
type SidebarLink = { text: string; link?: string };
type SidebarGroup = { text?: string; items?: SidebarLink[] };

const { theme, page } = useData();

const position = computed(() => {
  const currentLink = `/${page.value.relativePath.replace(/\.md$/, '')}`;
  const sidebar = theme.value.sidebar as Record<string, SidebarGroup[]> | undefined;

  for (const groups of Object.values(sidebar ?? {})) {
    for (const group of groups) {
      const items = group.items ?? [];
      const index = items.findIndex(item => item.link === currentLink);
      if (index === -1) continue;

      return { section: group.text ?? '', index: index + 1, total: items.length };
    }
  }

  return null;
});

const pad = (n: number) => String(n).padStart(2, '0');
</script>

<template>
  <div v-if="position" class="mg-eyebrow">
    <span>{{ position.section }}</span>
    <!-- `01 / 01` says nothing; a group of one has no position to report. -->
    <span v-if="position.total > 1">{{ pad(position.index) }} / {{ pad(position.total) }}</span>
  </div>
</template>
