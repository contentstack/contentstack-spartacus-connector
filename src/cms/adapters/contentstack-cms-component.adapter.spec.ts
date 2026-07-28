import { Observable, of } from 'rxjs';
import { ContentstackCmsComponentAdapter } from './contentstack-cms-component.adapter';

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
  const adapter = new ContentstackCmsComponentAdapter(
    client as never,
    normalizer as never,
    config as never,
    logger as never,
    languageService as never,
    occComponentAdapter as never,
  );
  return { adapter, client, normalizer, config, logger, languageService, occComponentAdapter };
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
});
