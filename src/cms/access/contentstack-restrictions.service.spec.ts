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
});
