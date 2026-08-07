import { ContentstackComponentTypeRegistry } from './contentstack-component-type.registry';

describe('ContentstackComponentTypeRegistry', () => {
  it('records and returns a uid → content-type mapping', () => {
    const reg = new ContentstackComponentTypeRegistry();
    reg.record('blt_banner', 'simple_responsive_banner_component');
    expect(reg.get('blt_banner')).toBe('simple_responsive_banner_component');
  });

  it('returns undefined for an unseen uid', () => {
    const reg = new ContentstackComponentTypeRegistry();
    expect(reg.get('blt_unknown')).toBeUndefined();
  });

  it('ignores a missing uid or content type (no-op)', () => {
    const reg = new ContentstackComponentTypeRegistry();
    reg.record(undefined, 'some_type');
    reg.record('blt_x', undefined);
    expect(reg.get('blt_x')).toBeUndefined();
  });

  it('last write wins for the same uid', () => {
    const reg = new ContentstackComponentTypeRegistry();
    reg.record('blt_a', 'type_one');
    reg.record('blt_a', 'type_two');
    expect(reg.get('blt_a')).toBe('type_two');
  });
});
