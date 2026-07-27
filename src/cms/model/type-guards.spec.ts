import {
  isContentstackFile,
  isMediaContainer,
  isNavigationNode,
  isResolvedEntry,
  isString,
} from './type-guards';

describe('type-guards', () => {
  it('isString', () => {
    expect(isString('x')).toBe(true);
    expect(isString(1)).toBe(false);
    expect(isString(undefined)).toBe(false);
  });

  it('isResolvedEntry distinguishes resolved entries from unresolved reference pointers', () => {
    expect(isResolvedEntry({ uid: 'a', created_at: '2026-01-01T00:00:00.000Z' })).toBe(true);
    expect(isResolvedEntry({ uid: 'a', _content_type_uid: 'nav_node' })).toBe(false);
    expect(isResolvedEntry(undefined)).toBe(false);
    expect(isResolvedEntry(null)).toBe(false);
  });

  it('isMediaContainer', () => {
    expect(
      isMediaContainer({ uid: 'a', _content_type_uid: 'media_container', created_at: '2026-01-01T00:00:00.000Z' })
    ).toBe(true);
    expect(
      isMediaContainer({ uid: 'a', _content_type_uid: 'nav_node', created_at: '2026-01-01T00:00:00.000Z' })
    ).toBe(false);
    expect(isMediaContainer({ uid: 'a', _content_type_uid: 'media_container' })).toBe(false);
  });

  it('isNavigationNode', () => {
    expect(
      isNavigationNode({ uid: 'a', _content_type_uid: 'nav_node', created_at: '2026-01-01T00:00:00.000Z' })
    ).toBe(true);
    expect(
      isNavigationNode({ uid: 'a', _content_type_uid: 'media_container', created_at: '2026-01-01T00:00:00.000Z' })
    ).toBe(false);
  });

  it('isContentstackFile', () => {
    expect(isContentstackFile({ url: 'u', filename: 'f', content_type: 'image/jpeg' })).toBe(true);
    expect(isContentstackFile({ url: 'u' })).toBe(false);
    expect(isContentstackFile(undefined)).toBe(false);
  });
});
