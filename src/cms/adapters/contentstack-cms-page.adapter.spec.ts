import { Observable, of, throwError } from 'rxjs';
import { HOME_PAGE_CONTEXT, SMART_EDIT_CONTEXT } from '@spartacus/core';
import { ContentstackCmsPageAdapter, navTreeIncludeRefs } from './contentstack-cms-page.adapter';
import { ContentstackRestrictionsService } from '../access/contentstack-restrictions.service';
import { ContentstackCurrentUser } from '../access/contentstack-current-user';

/**
 * Pure-logic spec (no TestBed): the adapter is instantiated directly with mock
 * collaborators, matching the offline jest config. Covers the branches that make
 * this the connector's most complex code — SmartEdit short-circuit, slug
 * resolution (homepage / content / shared PDP-PLP), the hybrid
 * OCC-base + global-shell + Contentstack merge, `occFallback` on/off, global-slot
 * include expansion, OCC failure resilience, and locale threading.
 */

/** Grab the value of a synchronous observable (all paths here emit via `of`). */
function firstValue<T>(obs: Observable<T>): T {
  let result!: T;
  let emitted = false;
  obs.subscribe({ next: (v) => ((result = v), (emitted = true)) });
  if (!emitted) {
    throw new Error('observable did not emit synchronously');
  }
  return result;
}

const DEFAULT_CS = {
  cmsPageContentType: 'content_page',
  slugField: 'url',
  includeReferences: [] as string[],
  occFallback: true,
};

interface Overrides {
  cs?: Record<string, unknown>;
  client?: Record<string, jest.Mock>;
  normalizer?: Record<string, jest.Mock>;
  occ?: Record<string, jest.Mock>;
  locale?: string;
  /** Current user for gating tests; omit for anonymous. */
  user?: ContentstackCurrentUser;
}

function create(over: Overrides = {}) {
  const client = {
    getPageBySlug: jest.fn().mockReturnValue(of(undefined)),
    getGlobalSlots: jest.fn().mockReturnValue(of(undefined)),
    ...over.client,
  };
  const normalizer = {
    convert: jest.fn(),
    buildStructure: jest.fn(),
    ...over.normalizer,
  };
  const config = { contentstack: { ...DEFAULT_CS, ...over.cs } };
  const languageService = {
    getActive: jest.fn().mockReturnValue(of(over.locale ?? 'en')),
  };
  const occPageAdapter = {
    load: jest.fn().mockReturnValue(of(undefined)),
    ...over.occ,
  };
  // Real restrictions service (the adapter's page-level gate calls it directly);
  // the current-user source is a simple observable of the test's user.
  const restrictions = new ContentstackRestrictionsService(config as never);
  const currentUser$ = of(over.user);
  const adapter = new ContentstackCmsPageAdapter(
    client as never,
    normalizer as never,
    config as never,
    languageService as never,
    occPageAdapter as never,
    restrictions,
    currentUser$,
  );
  return { adapter, client, normalizer, config, languageService, occPageAdapter };
}

const ctx = (id: string, type?: string) => ({ id, type }) as never;

describe('ContentstackCmsPageAdapter', () => {
  describe('SmartEdit context', () => {
    it('short-circuits to an empty structure without touching Contentstack', () => {
      const { adapter, client, occPageAdapter } = create();
      const res = firstValue(adapter.load(ctx(SMART_EDIT_CONTEXT)));
      expect(res).toEqual({});
      expect(client.getPageBySlug).not.toHaveBeenCalled();
      expect(occPageAdapter.load).not.toHaveBeenCalled();
    });
  });

  describe('configuration guard', () => {
    it('throws when cmsPageContentType is not configured', () => {
      const { adapter } = create({ cs: { cmsPageContentType: undefined } });
      expect(() => adapter.load(ctx('about'))).toThrow(/cmsPageContentType is not configured/);
    });
  });

  describe('slug resolution', () => {
    it('maps the homepage context to slug "/"', () => {
      const { adapter, client } = create();
      firstValue(adapter.load(ctx(HOME_PAGE_CONTEXT)));
      expect(client.getPageBySlug).toHaveBeenCalledWith('content_page', 'url', '/', [], 'en');
    });

    it('resolves a content page by its context id', () => {
      const { adapter, client } = create();
      firstValue(adapter.load(ctx('about-us')));
      expect(client.getPageBySlug).toHaveBeenCalledWith(
        'content_page',
        'url',
        'about-us',
        [],
        'en',
      );
    });

    it('resolves product/category pages to a single shared-slug layout', () => {
      const { adapter, client } = create({
        cs: {
          pageTypeMapping: {
            ProductPage: {
              sharedSlug: 'product',
              slugField: 'url',
              contentTypeUid: 'product_page',
            },
          },
        },
      });
      firstValue(adapter.load(ctx('1934793', 'ProductPage')));
      // The SKU in the route id is ignored — one entry serves every product.
      expect(client.getPageBySlug).toHaveBeenCalledWith('product_page', 'url', 'product', [], 'en');
    });

    it('threads the includeReferences config into the page query', () => {
      const { adapter, client } = create({ cs: { includeReferences: ['banner.media'] } });
      firstValue(adapter.load(ctx('home')));
      expect(client.getPageBySlug).toHaveBeenCalledWith(
        'content_page',
        'url',
        'home',
        ['banner.media'],
        'en',
      );
    });

    describe('slugTransform', () => {
      it('rewrites the route slug before querying when configured', () => {
        const { adapter, client } = create({
          cs: { slugTransform: { pattern: /^\/en\//, replacement: '/' } },
        });
        firstValue(adapter.load(ctx('/en/about-us')));
        expect(client.getPageBySlug).toHaveBeenCalledWith(
          'content_page',
          'url',
          '/about-us',
          [],
          'en',
        );
      });

      it('is a no-op by default (no config, no change)', () => {
        const { adapter, client } = create();
        firstValue(adapter.load(ctx('about-us')));
        expect(client.getPageBySlug).toHaveBeenCalledWith(
          'content_page',
          'url',
          'about-us',
          [],
          'en',
        );
      });

      it('does not apply to the shared-slug path (product/category pages)', () => {
        const { adapter, client } = create({
          cs: {
            // A transform that WOULD alter "product" if it were (wrongly)
            // applied to the shared-slug value.
            slugTransform: { pattern: /product/, replacement: 'mutated' },
            pageTypeMapping: {
              ProductPage: {
                sharedSlug: 'product',
                slugField: 'url',
                contentTypeUid: 'product_page',
              },
            },
          },
        });
        firstValue(adapter.load(ctx('1934793', 'ProductPage')));
        expect(client.getPageBySlug).toHaveBeenCalledWith(
          'product_page',
          'url',
          'product',
          [],
          'en',
        );
      });
    });
  });

  describe('hybrid merge (occFallback: true)', () => {
    it('layers Contentstack over the OCC base: authored slots override, others fall through', () => {
      const csStructure = {
        page: { slots: { Section2A: { components: [{ uid: 'cs1' }] } } },
        components: [{ uid: 'cs1', typeCode: 'CarouselComponent' }],
      };
      const occBase = {
        page: {
          template: 'ContentPage1Template',
          slots: {
            Section2A: { components: [{ uid: 'occOld' }] },
            BottomHeaderSlot: { components: [{ uid: 'occHeader' }] },
          },
        },
        components: [
          { uid: 'occOld', typeCode: 'OccOld' },
          { uid: 'occHeader', typeCode: 'OccHeader' },
        ],
      };
      const { adapter, normalizer } = create({
        client: { getPageBySlug: jest.fn().mockReturnValue(of({ uid: 'page-entry' })) },
        normalizer: { convert: jest.fn().mockReturnValue(csStructure) },
        occ: { load: jest.fn().mockReturnValue(of(occBase)) },
      });

      const res = firstValue(adapter.load(ctx('home')));

      // Contentstack wins on the slot it authors.
      expect(res.page!.slots!.Section2A).toEqual({ components: [{ uid: 'cs1' }] });
      // Unauthored slot falls through to OCC.
      expect(res.page!.slots!.BottomHeaderSlot).toEqual({ components: [{ uid: 'occHeader' }] });
      // Base pins the structural template.
      expect(res.page!.template).toBe('ContentPage1Template');
      // Components are the union, deduped by uid.
      const uids = res.components!.map((c) => c.uid).sort();
      expect(uids).toEqual(['cs1', 'occHeader', 'occOld']);
    });

    it('falls back entirely to OCC when Contentstack has no entry for the route', () => {
      const occBase = {
        page: { template: 'T', slots: { Header: { components: [{ uid: 'occH' }] } } },
        components: [{ uid: 'occH' }],
      };
      const { adapter, normalizer } = create({
        client: { getPageBySlug: jest.fn().mockReturnValue(of(undefined)) },
        occ: { load: jest.fn().mockReturnValue(of(occBase)) },
      });

      const res = firstValue(adapter.load(ctx('unknown-route')));
      expect(res.page!.slots!.Header).toEqual({ components: [{ uid: 'occH' }] });
      expect(normalizer.convert).not.toHaveBeenCalled();
    });

    it('degrades gracefully when the OCC base errors, still serving Contentstack content', () => {
      const csStructure = {
        page: { slots: { Section2A: { components: [{ uid: 'cs1' }] } } },
        components: [{ uid: 'cs1' }],
      };
      const { adapter } = create({
        client: { getPageBySlug: jest.fn().mockReturnValue(of({ uid: 'e' })) },
        normalizer: { convert: jest.fn().mockReturnValue(csStructure) },
        occ: { load: jest.fn().mockReturnValue(throwError(() => new Error('OCC down'))) },
      });

      const res = firstValue(adapter.load(ctx('home')));
      expect(res.page!.slots!.Section2A).toEqual({ components: [{ uid: 'cs1' }] });
    });
  });

  describe('full-replacement mode (occFallback: false)', () => {
    it('never loads the OCC base and returns empty when Contentstack has no entry', () => {
      const { adapter, occPageAdapter } = create({
        cs: { occFallback: false },
        client: { getPageBySlug: jest.fn().mockReturnValue(of(undefined)) },
      });
      const res = firstValue(adapter.load(ctx('unknown-route')));
      expect(res).toEqual({});
      expect(occPageAdapter.load).not.toHaveBeenCalled();
    });
  });

  describe('global slots (shared shell)', () => {
    it('fetches the shell with the deep navigation includes and layers it over the OCC base', () => {
      // Global shell layer (built via buildStructure, not convert).
      const globalStructure = {
        slots: { Footer: { components: [{ uid: 'g1' }] } },
        components: [{ uid: 'g1' }],
      };
      // OCC base underneath — global slots never render alone; there is always
      // a base (occFallback) or a Contentstack page keeping the route "found".
      const occBase = {
        page: {
          template: 'T',
          slots: {
            Footer: { components: [{ uid: 'occFooter' }] },
            Header: { components: [{ uid: 'occHeader' }] },
          },
        },
        components: [{ uid: 'occFooter' }, { uid: 'occHeader' }],
      };
      const { adapter, client } = create({
        cs: { globalSlots: { contentType: 'global_slots', title: 'Global' } },
        client: {
          getPageBySlug: jest.fn().mockReturnValue(of(undefined)),
          getGlobalSlots: jest.fn().mockReturnValue(of({ uid: 'global-entry' })),
        },
        normalizer: { buildStructure: jest.fn().mockReturnValue(globalStructure) },
        occ: { load: jest.fn().mockReturnValue(of(occBase)) },
      });

      const res = firstValue(adapter.load(ctx('home')));

      expect(client.getGlobalSlots).toHaveBeenCalledWith(
        'global_slots',
        'Global',
        expect.arrayContaining([
          'navigation_bar.navigation_node',
          'navigation_bar.navigation_node.children.entries',
          'footer.navigation_node',
        ]),
        'en',
      );
      // Shell overrides the OCC Footer; the OCC-only Header falls through.
      expect(res.page!.slots!.Footer).toEqual({ components: [{ uid: 'g1' }] });
      expect(res.page!.slots!.Header).toEqual({ components: [{ uid: 'occHeader' }] });
    });

    it('does not query global slots when none are configured', () => {
      const { adapter, client } = create();
      firstValue(adapter.load(ctx('home')));
      expect(client.getGlobalSlots).not.toHaveBeenCalled();
    });

    it('honors a configured navTreeIncludeDepth (plan-dependent include_depth cap)', () => {
      // Contentstack's include_depth ceiling varies by stack plan/tier (5 is
      // the lowest confirmed; higher tiers allow more) -- a stack on a higher
      // tier should be able to request deeper nav trees than the default.
      const { adapter, client } = create({
        cs: { globalSlots: { contentType: 'global_slots' }, navTreeIncludeDepth: 1 },
        client: {
          getPageBySlug: jest.fn().mockReturnValue(of(undefined)),
          getGlobalSlots: jest.fn().mockReturnValue(of(undefined)),
        },
      });

      firstValue(adapter.load(ctx('home')));

      const [, , includeRefs] = client.getGlobalSlots.mock.calls[0];
      expect(includeRefs).toEqual(expect.arrayContaining(navTreeIncludeRefs('navigation_bar', 1)));
      // Depth 1 must NOT reach into a second level of `.children`.
      expect(includeRefs).not.toContain('navigation_bar.navigation_node.children.children');
    });
  });

  describe('locale threading', () => {
    it('resolves content in the active language and passes it to the client', () => {
      const { adapter, client } = create({ locale: 'de' });
      firstValue(adapter.load(ctx('home')));
      expect(client.getPageBySlug).toHaveBeenCalledWith('content_page', 'url', 'home', [], 'de');
    });
  });

  describe('access-control (page-level gating)', () => {
    const GATING = {
      accessControl: { enabled: true, accessField: 'access_tags', rolePrefix: '_require-' },
    };

    it('renders a restricted page as not-found and does NOT fall through to the OCC base', () => {
      const occBase = {
        page: { template: 'T', slots: { Header: { components: [{ uid: 'occH' }] } } },
        components: [{ uid: 'occH' }],
      };
      const convert = jest.fn();
      const { adapter } = create({
        cs: GATING,
        // anonymous user (over.user omitted) against an admin-only page entry
        client: {
          getPageBySlug: jest
            .fn()
            .mockReturnValue(of({ uid: 'p', access_tags: ['_require-b2badmingroup'] })),
        },
        normalizer: { convert },
        occ: { load: jest.fn().mockReturnValue(of(occBase)) },
      });

      const res = firstValue(adapter.load(ctx('secret')));
      expect(res).toEqual({}); // not-found
      expect(convert).not.toHaveBeenCalled(); // gated before normalization
      // OCC twin must NOT be rendered.
      expect((res as { page?: unknown }).page).toBeUndefined();
    });

    it('passes the resolved permission set into the normalizer for a public page', () => {
      const csStructure = { page: { slots: {} }, components: [] };
      const convert = jest.fn().mockReturnValue(csStructure);
      const { adapter } = create({
        cs: GATING,
        user: { roles: ['b2badmingroup'] },
        client: { getPageBySlug: jest.fn().mockReturnValue(of({ uid: 'p' })) },
        normalizer: { convert },
      });

      firstValue(adapter.load(ctx('home')));
      const permissions = convert.mock.calls[0][2] as Set<string>;
      expect(permissions).toBeInstanceOf(Set);
      expect(permissions.has('_require-login')).toBe(true);
      expect(permissions.has('_require-b2badmingroup')).toBe(true);
    });

    it('does not gate the shared-slug product page unless gateSharedSlugPages is on', () => {
      const convert = jest.fn().mockReturnValue({ page: { slots: {} }, components: [] });
      const { adapter } = create({
        cs: {
          ...GATING,
          pageTypeMapping: {
            ProductPage: {
              sharedSlug: 'product',
              slugField: 'url',
              contentTypeUid: 'product_page',
            },
          },
        },
        client: {
          getPageBySlug: jest
            .fn()
            .mockReturnValue(of({ uid: 'pdp', access_tags: ['_require-b2badmingroup'] })),
        },
        normalizer: { convert },
      });

      const res = firstValue(adapter.load(ctx('1934793', 'ProductPage')));
      // Not gated → normalizer ran and produced a structure (not {}).
      expect(convert).toHaveBeenCalled();
      expect(res).not.toEqual({});
    });

    it('threads permissions + gateRoot:true into the client fetch so gated content is filtered before SSR', () => {
      const getPageBySlug = jest.fn().mockReturnValue(of({ uid: 'p' }));
      const { adapter } = create({
        cs: GATING,
        user: { roles: ['b2badmingroup'] },
        client: { getPageBySlug },
        normalizer: { convert: jest.fn().mockReturnValue({ page: { slots: {} }, components: [] }) },
      });

      firstValue(adapter.load(ctx('home')));
      const access = getPageBySlug.mock.calls[0][5];
      expect(access?.permissions).toBeInstanceOf(Set);
      expect(access?.permissions.has('_require-b2badmingroup')).toBe(true);
      expect(access?.gateRoot).toBe(true); // whole-page gating for a per-route page
    });

    it('threads gateRoot:false for a shared-slug page not opted into whole-page gating', () => {
      const getPageBySlug = jest.fn().mockReturnValue(of({ uid: 'pdp' }));
      const { adapter } = create({
        cs: {
          ...GATING,
          pageTypeMapping: {
            ProductPage: { sharedSlug: 'product', slugField: 'url', contentTypeUid: 'product_page' },
          },
        },
        client: { getPageBySlug },
        normalizer: { convert: jest.fn().mockReturnValue({ page: { slots: {} }, components: [] }) },
      });

      firstValue(adapter.load(ctx('1934793', 'ProductPage')));
      const access = getPageBySlug.mock.calls[0][5];
      expect(access?.permissions).toBeInstanceOf(Set);
      expect(access?.gateRoot).toBe(false); // nested-only sanitize; root kept
    });
  });
});

describe('navTreeIncludeRefs', () => {
  // `field.navigation_node` is 2 fixed segments; each `.children` level and
  // the trailing `.entries` cost one dot-segment each against Contentstack's
  // plan-dependent include_depth cap (2 + maxDepth + 1 total segments on the
  // deepest generated path).
  function segments(path: string): number {
    return path.split('.').length;
  }

  it('generates the root and its own entries at depth 0', () => {
    expect(navTreeIncludeRefs('footer', 0)).toEqual(['footer.navigation_node', 'footer.navigation_node.entries']);
  });

  it('adds one more level of children + entries per unit of depth', () => {
    expect(navTreeIncludeRefs('footer', 2)).toEqual([
      'footer.navigation_node',
      'footer.navigation_node.entries',
      'footer.navigation_node.children',
      'footer.navigation_node.children.entries',
      'footer.navigation_node.children.children',
      'footer.navigation_node.children.children.entries',
    ]);
  });

  it('never asks for something deeper than requested', () => {
    const paths = navTreeIncludeRefs('navigation_bar', 3);
    expect(paths).not.toContain('navigation_bar.navigation_node.children.children.children.children');
  });

  it.each([0, 1, 2, 5, 10])(
    'keeps the deepest path at exactly maxDepth + 3 segments (maxDepth=%i)',
    (maxDepth) => {
      const paths = navTreeIncludeRefs('footer', maxDepth);
      const deepest = Math.max(...paths.map(segments));
      // This is the invariant a caller relies on to stay under their plan's
      // include_depth cap: pass `planCap - 3` as maxDepth and the deepest
      // generated path lands exactly on the cap, never over it.
      expect(deepest).toBe(maxDepth + 3);
    },
  );

  it('is parameterized entirely by field name, with no hardcoded nav field', () => {
    expect(navTreeIncludeRefs('header_links', 1)[0]).toBe('header_links.navigation_node');
  });
});
