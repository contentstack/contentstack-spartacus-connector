import { ContentstackConfig } from '../../config/contentstack-config';
import { ContentstackEntry } from '../model/contentstack.model';
import { ContentstackRestrictionsService } from './contentstack-restrictions.service';

/**
 * Pure-logic spec (no TestBed) for the gating primitives: permission derivation
 * and per-entry accessibility, plus the defaults the config falls back to.
 */
describe('ContentstackRestrictionsService', () => {
  const make = (accessControl: Record<string, unknown> = {}) =>
    new ContentstackRestrictionsService({
      contentstack: {
        delivery: { apiKey: 'k', deliveryToken: 't', environment: 'production' },
        accessControl,
      },
    } as ContentstackConfig);

  describe('enabled()', () => {
    it('reflects accessControl.enabled', () => {
      expect(make({ enabled: true }).enabled()).toBe(true);
      expect(make({ enabled: false }).enabled()).toBe(false);
      expect(make({}).enabled()).toBe(false);
    });
  });

  describe('getPermissions()', () => {
    const svc = make({ enabled: true });

    it('grants only the anonymous token to an anonymous user', () => {
      expect(svc.getPermissions(undefined)).toEqual(new Set(['_require-anonymous']));
    });

    it('grants login + one prefixed token per role to a logged-in user', () => {
      expect(svc.getPermissions({ roles: ['b2badmingroup', 'b2bcustomergroup'] })).toEqual(
        new Set(['_require-login', '_require-b2badmingroup', '_require-b2bcustomergroup']),
      );
    });

    it('grants just the login token to a logged-in user with no roles', () => {
      expect(svc.getPermissions({})).toEqual(new Set(['_require-login']));
      expect(svc.getPermissions({ roles: undefined })).toEqual(new Set(['_require-login']));
    });

    it('honours custom token/prefix config', () => {
      const custom = make({ enabled: true, loginToken: 'LOGGED_IN', rolePrefix: 'role:' });
      expect(custom.getPermissions({ roles: ['admin'] })).toEqual(
        new Set(['LOGGED_IN', 'role:admin']),
      );
    });
  });

  describe('isEntryAccessible()', () => {
    const svc = make({ enabled: true });
    const entry = (tokens?: unknown): ContentstackEntry =>
      ({ uid: 'e', ...(tokens === undefined ? {} : { access_tags: tokens }) }) as ContentstackEntry;

    it('treats an entry with no/empty/non-array token field as public', () => {
      const anyone = new Set<string>();
      expect(svc.isEntryAccessible(entry(), anyone)).toBe(true);
      expect(svc.isEntryAccessible(entry([]), anyone)).toBe(true);
      expect(svc.isEntryAccessible(entry('not-an-array'), anyone)).toBe(true);
    });

    it('hides a _require-login entry from anonymous, shows it to a logged-in user', () => {
      expect(
        svc.isEntryAccessible(entry(['_require-login']), new Set(['_require-anonymous'])),
      ).toBe(false);
      expect(svc.isEntryAccessible(entry(['_require-login']), new Set(['_require-login']))).toBe(
        true,
      );
    });

    it('gates a role-tagged entry to users holding that role token', () => {
      const tokens = ['_require-b2badmingroup'];
      expect(svc.isEntryAccessible(entry(tokens), new Set(['_require-login']))).toBe(false);
      expect(
        svc.isEntryAccessible(entry(tokens), new Set(['_require-login', '_require-b2badmingroup'])),
      ).toBe(true);
    });

    it('requires ALL prefixed tokens on the entry to be held', () => {
      const tokens = ['_require-login', '_require-b2badmingroup'];
      expect(svc.isEntryAccessible(entry(tokens), new Set(['_require-login']))).toBe(false);
      expect(
        svc.isEntryAccessible(entry(tokens), new Set(['_require-login', '_require-b2badmingroup'])),
      ).toBe(true);
    });

    it('ignores tokens that do not start with the role prefix', () => {
      // `editorial-note` isn't a gating token → entry stays public.
      expect(svc.isEntryAccessible(entry(['editorial-note']), new Set())).toBe(true);
    });
  });

  // --- filter gated content BEFORE it reaches SSR TransferState ---

  describe('cacheKeySuffix()', () => {
    const svc = make({ enabled: true });

    it('is empty when gating is off (no permissions) so keys are unchanged', () => {
      expect(svc.cacheKeySuffix(undefined)).toBe('');
      expect(svc.cacheKeySuffix(new Set())).toBe('');
    });

    it('is a stable, order-independent per-audience fragment', () => {
      const a = svc.cacheKeySuffix(new Set(['_require-login', '_require-admin']));
      const b = svc.cacheKeySuffix(new Set(['_require-admin', '_require-login']));
      expect(a).toBe(b); // sorted → order-independent
      expect(a).toBe(':acl=_require-admin|_require-login');
      // Different audiences get different keys (no cross-serving).
      expect(svc.cacheKeySuffix(new Set(['_require-login']))).not.toBe(a);
    });
  });

  describe('redactEntry()', () => {
    const svc = make({ enabled: true });

    it('keeps only uid, content-type and the access field — no content', () => {
      const stub = svc.redactEntry({
        uid: 'e1',
        _content_type_uid: 'promo',
        access_tags: ['_require-login'],
        title: 'Secret Q4 pricing',
        body: 'embargoed',
      } as ContentstackEntry);
      expect(stub).toEqual({
        uid: 'e1',
        _content_type_uid: 'promo',
        access_tags: ['_require-login'],
      });
      // Still reported restricted downstream (tags survive), so "restricted" stays
      // distinct from "absent".
      expect(svc.isEntryAccessible(stub, new Set(['_require-anonymous']))).toBe(false);
    });
  });

  describe('sanitizeForTransfer()', () => {
    const svc = make({ enabled: true });
    const anon = new Set(['_require-anonymous']);

    it('strips restricted nested references from arrays and single-ref fields', () => {
      const page = {
        uid: 'p1',
        title: 'Home',
        section1: [
          { uid: 'c1', title: 'public' },
          { uid: 'c2', title: 'members only', access_tags: ['_require-login'] },
        ],
        hero: { uid: 'h1', title: 'gated hero', access_tags: ['_require-login'] },
        footer: { uid: 'f1', title: 'public footer' },
      } as unknown as ContentstackEntry;

      const safe = svc.sanitizeForTransfer(page, anon, /* gateRoot */ true);

      expect((safe.section1 as ContentstackEntry[]).map((c) => c.uid)).toEqual(['c1']);
      expect(safe.hero).toBeUndefined(); // restricted single ref dropped
      expect((safe.footer as ContentstackEntry).uid).toBe('f1'); // public ref kept
      expect(safe.title).toBe('Home'); // accessible root content preserved
    });

    it('redacts the root to a stub when gateRoot and the root itself is restricted', () => {
      const page = {
        uid: 'p2',
        _content_type_uid: 'landing_page',
        access_tags: ['_require-login'],
        title: 'Members landing',
        section1: [{ uid: 'c1', title: 'child' }],
      } as unknown as ContentstackEntry;

      const safe = svc.sanitizeForTransfer(page, anon, true);
      expect(safe).toEqual({
        uid: 'p2',
        _content_type_uid: 'landing_page',
        access_tags: ['_require-login'],
      });
      expect(safe.title).toBeUndefined(); // content did NOT survive
    });

    it('keeps a restricted root when gateRoot is false (nested-only sanitize)', () => {
      const entry = {
        uid: 'p3',
        access_tags: ['_require-login'],
        title: 'kept',
        child: { uid: 'x', access_tags: ['_require-admin'] },
      } as unknown as ContentstackEntry;

      const safe = svc.sanitizeForTransfer(entry, anon, false);
      expect(safe.title).toBe('kept'); // root retained
      expect(safe.child).toBeUndefined(); // nested restricted still stripped
    });
  });
});
