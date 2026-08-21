import { Observable, of } from 'rxjs';
import { ContentstackCmsComponentAdapter } from './contentstack-cms-component.adapter';
import { ContentstackRestrictionsService } from '../access/contentstack-restrictions.service';
import { ContentstackComponentTypeRegistry } from '../model/contentstack-component-type.registry';
import { ContentstackCurrentUser } from '../access/contentstack-current-user';

/**
 * Pure-logic spec (no TestBed). Covers both entry points (`load`,
 * `findComponentsByIds`) across the config matrix: componentContentType present
 * or absent × occFallback on or off, plus the partial-resolution OCC merge and
 * locale threading.
 */

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
  componentContentType: 'cms_component',
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
  /** Pre-seed the uid → content-type registry (learned types from page payloads). */
  registry?: Record<string, string>;
}

function create(over: Overrides = {}) {
  const client = {
    getEntryByUid: jest.fn().mockReturnValue(of(undefined)),
    getEntriesByUids: jest.fn().mockReturnValue(of([])),
    ...over.client,
  };
  const normalizer = {
    // Default: echo the uid so assertions can trace which entries were converted.
    convert: jest.fn((e: { uid: string }) => ({ uid: e.uid, typeCode: 'CS' })),
    ...over.normalizer,
  };
  const config = { contentstack: { ...DEFAULT_CS, ...over.cs } };
  const logger = { warn: jest.fn() };
  const languageService = {
    getActive: jest.fn().mockReturnValue(of(over.locale ?? 'en')),
  };
  const occComponentAdapter = {
    load: jest.fn().mockReturnValue(of({ uid: 'occ-loaded' })),
    findComponentsByIds: jest.fn().mockReturnValue(of([])),
    ...over.occ,
  };
  const restrictions = new ContentstackRestrictionsService(config as never);
  const typeRegistry = new ContentstackComponentTypeRegistry();
  for (const [uid, type] of Object.entries(over.registry ?? {})) {
    typeRegistry.record(uid, type);
  }
  const currentUser$ = of(over.user);
  const adapter = new ContentstackCmsComponentAdapter(
    client as never,
    normalizer as never,
    config as never,
    logger as never,
    languageService as never,
    occComponentAdapter as never,
    restrictions,
    typeRegistry,
    currentUser$,
  );
  return {
    adapter,
    client,
    normalizer,
    config,
    logger,
    languageService,
    occComponentAdapter,
    typeRegistry,
  };
}

const ctx = { id: 'homepage', type: 'ContentPage' } as never;

describe('ContentstackCmsComponentAdapter', () => {
  describe('load()', () => {
    it('returns the normalized Contentstack component when the entry exists', () => {
      const { adapter, client, normalizer } = create({
        client: { getEntryByUid: jest.fn().mockReturnValue(of({ uid: 'banner1' })) },
      });
      const res = firstValue(adapter.load('banner1', ctx));
      expect(client.getEntryByUid).toHaveBeenCalledWith('cms_component', 'banner1', 'en');
      expect(normalizer.convert).toHaveBeenCalledWith({ uid: 'banner1' });
      expect(res).toEqual({ uid: 'banner1', typeCode: 'CS' });
    });

    it('falls back to OCC when the entry is not in Contentstack (occFallback: true)', () => {
      const { adapter, occComponentAdapter } = create({
        client: { getEntryByUid: jest.fn().mockReturnValue(of(undefined)) },
      });
      const res = firstValue(adapter.load('missing', ctx));
      expect(occComponentAdapter.load).toHaveBeenCalledWith('missing', ctx);
      expect(res).toEqual({ uid: 'occ-loaded' });
    });

    it('returns a bare shell when the entry is missing and occFallback is off', () => {
      const { adapter, occComponentAdapter } = create({
        cs: { occFallback: false },
        client: { getEntryByUid: jest.fn().mockReturnValue(of(undefined)) },
      });
      const res = firstValue(adapter.load('missing', ctx));
      expect(res).toEqual({ uid: 'missing' });
      expect(occComponentAdapter.load).not.toHaveBeenCalled();
    });

    it('delegates straight to OCC when no componentContentType is configured (occFallback: true)', () => {
      const { adapter, client, occComponentAdapter } = create({
        cs: { componentContentType: undefined },
      });
      const res = firstValue(adapter.load('banner1', ctx));
      expect(occComponentAdapter.load).toHaveBeenCalledWith('banner1', ctx);
      expect(client.getEntryByUid).not.toHaveBeenCalled();
      expect(res).toEqual({ uid: 'occ-loaded' });
    });

    it('warns and returns a shell when no componentContentType and occFallback is off', () => {
      const { adapter, logger } = create({
        cs: { componentContentType: undefined, occFallback: false },
      });
      const res = firstValue(adapter.load('banner1', ctx));
      expect(res).toEqual({ uid: 'banner1' });
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).toContain('componentContentType is not configured');
    });

    // Spartacus's `clearCmsState` meta-reducer wipes the CMS store on a
    // language/currency/login change and redispatches a per-uid reload for
    // EVERY already-mounted component, regardless of its type -- not just
    // the ones this adapter's componentContentType models (e.g. banners,
    // not just cms_link_component leaves). A Contentstack-native uid
    // (`blt...`) that isn't found under componentContentType will never
    // exist in OCC either; forwarding it anyway would fail a beat later and
    // flip the already-mounted component's data$ to `null`, which several
    // stock components (BannerComponent, SearchBoxComponent) don't
    // null-guard and crash on.
    it('never forwards a Contentstack-shaped uid (blt...) to OCC, even when not found under componentContentType', () => {
      const { adapter, occComponentAdapter } = create({
        client: { getEntryByUid: jest.fn().mockReturnValue(of(undefined)) },
      });
      const res = firstValue(adapter.load('bltbanner123', ctx));
      expect(res).toEqual({ uid: 'bltbanner123' });
      expect(occComponentAdapter.load).not.toHaveBeenCalled();
    });

    it('never forwards a Contentstack-shaped uid to OCC when no componentContentType is configured', () => {
      const { adapter, occComponentAdapter } = create({
        cs: { componentContentType: undefined },
      });
      const res = firstValue(adapter.load('bltbanner123', ctx));
      expect(res).toEqual({ uid: 'bltbanner123' });
      expect(occComponentAdapter.load).not.toHaveBeenCalled();
    });

    // The fix for stale content on a language switch: a component's real type is
    // learned when it arrives in a page payload (recorded in the registry), so a
    // per-uid reload re-fetches it as ITS type in the active locale — instead of
    // missing the single configured componentContentType and returning a stale
    // shell that leaves the previous locale's data (e.g. its image) in the store.
    it('re-fetches a component under its LEARNED content type, not the configured default', () => {
      const { adapter, client, normalizer } = create({
        registry: { bltbanner123: 'simple_responsive_banner_component' },
        client: { getEntryByUid: jest.fn().mockReturnValue(of({ uid: 'bltbanner123' })) },
      });
      const res = firstValue(adapter.load('bltbanner123', ctx));
      expect(client.getEntryByUid).toHaveBeenCalledWith(
        'simple_responsive_banner_component',
        'bltbanner123',
        'en',
      );
      expect(normalizer.convert).toHaveBeenCalledWith({ uid: 'bltbanner123' });
      expect(res).toEqual({ uid: 'bltbanner123', typeCode: 'CS' });
    });

    it('threads the active locale into the learned-type re-fetch (language switch)', () => {
      const { adapter, client } = create({
        locale: 'de',
        registry: { bltbanner123: 'simple_responsive_banner_component' },
        client: { getEntryByUid: jest.fn().mockReturnValue(of({ uid: 'bltbanner123' })) },
      });
      firstValue(adapter.load('bltbanner123', ctx));
      expect(client.getEntryByUid).toHaveBeenCalledWith(
        'simple_responsive_banner_component',
        'bltbanner123',
        'de',
      );
    });
  });

  describe('findComponentsByIds()', () => {
    it('returns only Contentstack components when all ids resolve (occFallback: true)', () => {
      const { adapter, occComponentAdapter } = create({
        client: {
          getEntriesByUids: jest.fn().mockReturnValue(of([{ uid: 'a' }, { uid: 'b' }])),
        },
      });
      const res = firstValue(adapter.findComponentsByIds(['a', 'b'], ctx));
      expect(res).toEqual([
        { uid: 'a', typeCode: 'CS' },
        { uid: 'b', typeCode: 'CS' },
      ]);
      // Nothing left over → OCC is not queried.
      expect(occComponentAdapter.findComponentsByIds).not.toHaveBeenCalled();
    });

    it('groups a mixed reload batch by learned content type and never sends a blt uid to OCC', () => {
      // Mirrors the batch Spartacus fires on a language switch: cms_link_component
      // leaves + banners + OCC-shaped ids together. Each Contentstack type must be
      // fetched as itself; only genuinely OCC-shaped, unresolved ids go to OCC.
      const getEntriesByUids = jest.fn((type: string, uids: string[]) =>
        of(uids.filter((u) => u.startsWith('blt')).map((uid) => ({ uid, _content_type_uid: type }))),
      );
      const { adapter, occComponentAdapter } = create({
        registry: { bltbanner: 'simple_responsive_banner_component' },
        client: { getEntriesByUids },
        occ: {
          findComponentsByIds: jest
            .fn()
            .mockReturnValue(of([{ uid: 'QuickOrderLink', typeCode: 'OCC' }])),
        },
      });
      const res = firstValue(
        adapter.findComponentsByIds(['bltlink', 'bltbanner', 'QuickOrderLink'], ctx),
      );
      // bltlink + QuickOrderLink resolve to the configured default; banner to its own type.
      expect(getEntriesByUids).toHaveBeenCalledWith('cms_component', ['bltlink', 'QuickOrderLink'], 'en');
      expect(getEntriesByUids).toHaveBeenCalledWith(
        'simple_responsive_banner_component',
        ['bltbanner'],
        'en',
      );
      // Only the OCC-shaped, unresolved id reaches OCC — never a blt uid.
      expect(occComponentAdapter.findComponentsByIds).toHaveBeenCalledWith(['QuickOrderLink'], ctx);
      expect(res.map((c) => c.uid).sort()).toEqual(['QuickOrderLink', 'bltbanner', 'bltlink']);
    });

    it('serves unresolved ids from OCC and merges them after the Contentstack ones', () => {
      const { adapter, occComponentAdapter } = create({
        client: { getEntriesByUids: jest.fn().mockReturnValue(of([{ uid: 'a' }])) },
        occ: {
          findComponentsByIds: jest.fn().mockReturnValue(of([{ uid: 'b', typeCode: 'OCC' }])),
        },
      });
      const res = firstValue(adapter.findComponentsByIds(['a', 'b'], ctx));
      // Only the missing id 'b' is requested from OCC.
      expect(occComponentAdapter.findComponentsByIds).toHaveBeenCalledWith(['b'], ctx);
      expect(res).toEqual([
        { uid: 'a', typeCode: 'CS' },
        { uid: 'b', typeCode: 'OCC' },
      ]);
    });

    it('does not consult OCC for unresolved ids when occFallback is off', () => {
      const { adapter, occComponentAdapter } = create({
        cs: { occFallback: false },
        client: { getEntriesByUids: jest.fn().mockReturnValue(of([{ uid: 'a' }])) },
      });
      const res = firstValue(adapter.findComponentsByIds(['a', 'b'], ctx));
      expect(res).toEqual([{ uid: 'a', typeCode: 'CS' }]);
      expect(occComponentAdapter.findComponentsByIds).not.toHaveBeenCalled();
    });

    it('delegates to OCC when no componentContentType is configured (occFallback: true)', () => {
      const { adapter, client, occComponentAdapter } = create({
        cs: { componentContentType: undefined },
        occ: {
          findComponentsByIds: jest.fn().mockReturnValue(of([{ uid: 'a' }, { uid: 'b' }])),
        },
      });
      const res = firstValue(adapter.findComponentsByIds(['a', 'b'], ctx));
      expect(client.getEntriesByUids).not.toHaveBeenCalled();
      expect(occComponentAdapter.findComponentsByIds).toHaveBeenCalledWith(['a', 'b'], ctx);
      expect(res).toEqual([{ uid: 'a' }, { uid: 'b' }]);
    });

    it('warns and returns [] when no componentContentType and occFallback is off', () => {
      const { adapter, logger } = create({
        cs: { componentContentType: undefined, occFallback: false },
      });
      const res = firstValue(adapter.findComponentsByIds(['a', 'b'], ctx));
      expect(res).toEqual([]);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('gives unresolved Contentstack-shaped uids a shell instead of forwarding them to OCC', () => {
      const { adapter, occComponentAdapter } = create({
        client: { getEntriesByUids: jest.fn().mockReturnValue(of([{ uid: 'a' }])) },
      });
      const res = firstValue(adapter.findComponentsByIds(['a', 'bltmissing'], ctx));
      expect(res).toEqual([{ uid: 'a', typeCode: 'CS' }, { uid: 'bltmissing' }]);
      expect(occComponentAdapter.findComponentsByIds).not.toHaveBeenCalled();
    });

    it('mixes shells (Contentstack-shaped) and a real OCC fetch (non-Contentstack-shaped) among unresolved ids', () => {
      const { adapter, occComponentAdapter } = create({
        client: { getEntriesByUids: jest.fn().mockReturnValue(of([{ uid: 'a' }])) },
        occ: {
          findComponentsByIds: jest.fn().mockReturnValue(of([{ uid: 'occ-link', typeCode: 'OCC' }])),
        },
      });
      const res = firstValue(adapter.findComponentsByIds(['a', 'bltmissing', 'occ-link'], ctx));
      expect(occComponentAdapter.findComponentsByIds).toHaveBeenCalledWith(['occ-link'], ctx);
      expect(res).toEqual([
        { uid: 'a', typeCode: 'CS' },
        { uid: 'bltmissing' },
        { uid: 'occ-link', typeCode: 'OCC' },
      ]);
    });

    it('never forwards Contentstack-shaped uids to OCC when no componentContentType is configured', () => {
      const { adapter, occComponentAdapter } = create({
        cs: { componentContentType: undefined },
        occ: {
          findComponentsByIds: jest.fn().mockReturnValue(of([{ uid: 'occ-a' }])),
        },
      });
      const res = firstValue(adapter.findComponentsByIds(['bltbanner', 'occ-a'], ctx));
      expect(occComponentAdapter.findComponentsByIds).toHaveBeenCalledWith(['occ-a'], ctx);
      expect(res).toEqual([{ uid: 'bltbanner' }, { uid: 'occ-a' }]);
    });
  });

  describe('locale threading', () => {
    it('passes the active language to the client on both entry points', () => {
      const { adapter, client } = create({
        locale: 'de',
        client: {
          getEntryByUid: jest.fn().mockReturnValue(of({ uid: 'a' })),
          getEntriesByUids: jest.fn().mockReturnValue(of([{ uid: 'a' }])),
        },
      });
      firstValue(adapter.load('a', ctx));
      firstValue(adapter.findComponentsByIds(['a'], ctx));
      expect(client.getEntryByUid).toHaveBeenCalledWith('cms_component', 'a', 'de');
      expect(client.getEntriesByUids).toHaveBeenCalledWith('cms_component', ['a'], 'de');
    });
  });

  describe('access-control gating', () => {
    const GATING = {
      accessControl: { enabled: true, accessField: 'access_tags', rolePrefix: '_require-' },
    };

    it('load(): a restricted entry returns a bare shell, never the OCC fallback', () => {
      const { adapter, occComponentAdapter, normalizer } = create({
        cs: GATING, // anonymous user
        client: {
          getEntryByUid: jest
            .fn()
            .mockReturnValue(of({ uid: 'banner1', access_tags: ['_require-b2badmingroup'] })),
        },
      });
      const res = firstValue(adapter.load('banner1', ctx));
      expect(res).toEqual({ uid: 'banner1' }); // shell, not converted
      expect(normalizer.convert).not.toHaveBeenCalled();
      expect(occComponentAdapter.load).not.toHaveBeenCalled(); // no OCC twin
    });

    it('load(): a restricted entry is served to a user who holds the token', () => {
      const { adapter, normalizer } = create({
        cs: GATING,
        user: { roles: ['b2badmingroup'] },
        client: {
          getEntryByUid: jest
            .fn()
            .mockReturnValue(of({ uid: 'banner1', access_tags: ['_require-b2badmingroup'] })),
        },
      });
      const res = firstValue(adapter.load('banner1', ctx));
      expect(res).toEqual({ uid: 'banner1', typeCode: 'CS' });
      expect(normalizer.convert).toHaveBeenCalled();
    });

    it('findComponentsByIds(): a restricted id is excluded AND not re-fetched from OCC', () => {
      const { adapter, occComponentAdapter } = create({
        cs: GATING, // anonymous
        client: {
          getEntriesByUids: jest
            .fn()
            .mockReturnValue(
              of([{ uid: 'a' }, { uid: 'b', access_tags: ['_require-b2badmingroup'] }]),
            ),
        },
      });
      const res = firstValue(adapter.findComponentsByIds(['a', 'b'], ctx));
      // 'b' is gated out of the result...
      expect(res).toEqual([{ uid: 'a', typeCode: 'CS' }]);
      // ...and NOT passed to OCC as a "missing" id (it resolved, just restricted).
      expect(occComponentAdapter.findComponentsByIds).not.toHaveBeenCalled();
    });
  });
});
