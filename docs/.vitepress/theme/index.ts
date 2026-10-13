import { h } from 'vue';
import DefaultTheme from 'vitepress/theme';
import DocEyebrow from './DocEyebrow.vue';
import HeroPanel from './HeroPanel.vue';
import VersionMark from './VersionMark.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-title-after': () => h(VersionMark),
      'doc-before': () => h(DocEyebrow),
      'home-hero-image': () => h(HeroPanel),
    }),
};
