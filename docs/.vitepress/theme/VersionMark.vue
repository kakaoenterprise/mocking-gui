<script setup lang="ts">
/**
 * The version these pages describe, printed beside the title.
 *
 * Injected by `vite.define` from the package itself, so it cannot drift from
 * what is published — and it tells a reader which release the examples match,
 * which is the first thing anyone checks against a library's docs.
 */
declare const __PKG_VERSION__: string;

const version = __PKG_VERSION__;
</script>

<template>
  <span class="mg-version-mark">v{{ version }}</span>
</template>
