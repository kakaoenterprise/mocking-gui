<script setup lang="ts">
/**
 * The hero art is the product's own output rather than a picture of it: the
 * same rows the panel draws, in the same alphabet the rest of the page uses.
 *
 * It is built from tokens, not from a flat asset, so it follows the colour
 * scheme and never goes stale against a redesign — the reason the identity
 * note rejected the architecture PNG that used to sit here.
 *
 * `aria-hidden`: every fact in it is already said in the copy beside it, so to
 * a screen reader this is decoration.
 */
interface Row {
  method: string;
  path: string;
  variant: string;
  status: number;
  tone: 'ok' | 'warn' | 'bad';
  delay?: string;
  active?: boolean;
}

const rows: Row[] = [
  { method: 'GET', path: '/api/user', variant: 'Success', status: 200, tone: 'ok' },
  { method: 'GET', path: '/api/user/plan', variant: 'Empty', status: 200, tone: 'ok' },
  {
    method: 'POST',
    path: '/api/seats',
    variant: 'Server error',
    status: 500,
    tone: 'bad',
    active: true,
  },
  {
    method: 'GET',
    path: '/api/session',
    variant: 'Expired',
    status: 401,
    tone: 'warn',
    delay: '2s',
  },
];
</script>

<template>
  <div class="mgp" aria-hidden="true">
    <div class="mgp__bar">
      <span class="mgp__mark">Mocking GUI</span>
      <span class="mgp__meta">4 endpoints · mocking on</span>
    </div>

    <ul class="mgp__rows">
      <li v-for="row in rows" :key="row.path" class="mgp__row" :class="{ 'is-active': row.active }">
        <span class="mgp__method">{{ row.method }}</span>
        <span class="mgp__path">{{ row.path }}</span>
        <span class="mgp__variant">{{ row.variant }}</span>
        <span class="mgp__status" :data-tone="row.tone">{{ row.status }}</span>
        <span class="mgp__delay">{{ row.delay ?? '' }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mgp {
  width: 100%;
  max-width: 440px;
  border: 1px solid var(--mg-rule-strong);
  background: var(--mg-paper);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  line-height: 1.5;
  user-select: none;
}

/* The chrome row names the thing, in the chrome's own alphabet. */
.mgp__bar {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--mg-rule-strong);
}

.mgp__mark {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mg-ink);
}

.mgp__meta {
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--mg-faint);
}

.mgp__rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* One endpoint, one row — the noun the whole visual system is built from. */
.mgp__row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto auto 24px;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-top: 1px solid var(--mg-rule);
}

.mgp__row:first-child {
  border-top: 0;
}

/* The row being shown off is marked by a rule on its edge, not by a fill. */
.mgp__row.is-active {
  background: var(--mg-paper-sunk);
  box-shadow: inset 2px 0 0 var(--mg-bad);
}

.mgp__method {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--mg-muted);
}

.mgp__path {
  color: var(--mg-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mgp__variant {
  color: var(--mg-ink-soft);
  white-space: nowrap;
}

.mgp__status {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.mgp__status[data-tone='ok'] {
  color: var(--mg-ok);
}

.mgp__status[data-tone='warn'] {
  color: var(--mg-warn);
}

.mgp__status[data-tone='bad'] {
  color: var(--mg-bad);
}

.mgp__delay {
  text-align: right;
  color: var(--mg-warn);
}

@media (max-width: 639px) {
  .mgp {
    max-width: 100%;
    font-size: 10px;
  }

  .mgp__variant {
    display: none;
  }

  .mgp__row {
    grid-template-columns: 34px minmax(0, 1fr) auto 22px;
  }
}
</style>
