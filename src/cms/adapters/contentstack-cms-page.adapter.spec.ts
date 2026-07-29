import { of } from 'rxjs';
import { HOME_PAGE_CONTEXT, PageContext } from '@spartacus/core';
import { ContentstackCmsPageAdapter } from './contentstack-cms-page.adapter';
import { ContentstackConfig } from '../../config/contentstack-config';

/** Minimal PageContext for a content route. */
const ctx = (id: string): PageContext => ({ id, type: 'ContentPage' } as unknown as PageContext);

function makeAdapter(contentstack: ContentstackConfig['contentstack']) {
  const client = { getPageBySlug: jest.fn().mockReturnValue(of(null)), getGlobalSlots: jest.fn() };
  const normalizer = { convert: jest.fn() };
  const languageService = { getActive: jest.fn().mockReturnValue(of('en-us')) };
  const occPageAdapter = { load: jest.fn().mockReturnValue(of({})) };
  const config = { contentstack } as ContentstackConfig;
  const adapter = new ContentstackCmsPageAdapter(
    client as never,
    normalizer as never,
    config,
    languageService as never,
    occPageAdapter as never
  );
  return { adapter, client, occPageAdapter };
}

describe('ContentstackCmsPageAdapter', () => {
  describe('resolveRequest (per-route contentTypeByUrl override)', () => {
    it('routes a matching slug to its overridden content type', () => {
      const { adapter } = makeAdapter({
        cmsPageContentType: 'landing_page',
        contentTypeByUrl: { '/organization': 'company_page' },
      });
      const req = (adapter as any).resolveRequest(ctx('/organization'));
      expect(req).toEqual({ contentType: 'company_page', slugField: 'url', slug: '/organization' });
    });

    it('falls back to cmsPageContentType when the slug is not mapped', () => {
      const { adapter } = makeAdapter({
        cmsPageContentType: 'landing_page',
        contentTypeByUrl: { '/organization': 'company_page' },
      });
      const req = (adapter as any).resolveRequest(ctx('/faq'));
      expect(req).toEqual({ contentType: 'landing_page', slugField: 'url', slug: '/faq' });
    });

    it('resolves the homepage context to slug "/"', () => {
      const { adapter } = makeAdapter({ cmsPageContentType: 'landing_page' });
      const req = (adapter as any).resolveRequest(ctx(HOME_PAGE_CONTEXT));
      expect(req.slug).toBe('/');
    });
  });

  describe('load (nested media_container includes)', () => {
    it('expands each slot include with its .media_container path', (done) => {
      const { adapter, client } = makeAdapter({
        cmsPageContentType: 'landing_page',
        includeReferences: ['section1', 'section3'],
        occFallback: true,
      });
      adapter.load(ctx('/')).subscribe(() => {
        const includeArg = client.getPageBySlug.mock.calls[0][3];
        expect(includeArg).toEqual([
          'section1',
          'section1.media_container',
          'section3',
          'section3.media_container',
        ]);
        done();
      });
    });
  });
});
