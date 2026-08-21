import { ContentstackCmsPageEntry } from '../../model/contentstack.model';

/**
 * A representative raw Contentstack `cms_page` entry, as the Delivery API
 * returns it once `includeReference` has resolved the slot fields — matching
 * the Content Model Starter Pack shipped schema: named per-slot
 * multi-reference fields (`section1`, `body_content`), each holding resolved
 * component-type entries with their own `_content_type_uid`. Typed against the
 * real model so `tsc` verifies the fixture matches what the normalizer consumes.
 *
 * Used by `contentstack-cms-page.normalizer.spec.ts`.
 */
export const cmsPageEntryFixture: ContentstackCmsPageEntry = {
  uid: 'blt_home_page',
  _content_type_uid: 'cms_page',
  locale: 'en-us',
  title: 'Home',
  url: '/',
  type: 'ContentPage',
  template: 'LandingPage2Template',
  // `section1` (SAP slot `Section1`) → a resolved banner component entry
  section1: [
    {
      uid: 'blt_hero_1',
      _content_type_uid: 'simple_responsive_banner_component',
      locale: 'en-us',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      headline: 'Power through any job',
      content: 'Pro-grade cordless tools',
      url_link: '/c/power-tools',
    },
  ],
  // `body_content` (SAP slot `BodyContent`) → a resolved paragraph component entry
  body_content: [
    {
      uid: 'blt_paragraph_1',
      _content_type_uid: 'cms_paragraph_component',
      locale: 'en-us',
      content: '<p>Free shipping over $50.</p>',
    },
  ],
};
