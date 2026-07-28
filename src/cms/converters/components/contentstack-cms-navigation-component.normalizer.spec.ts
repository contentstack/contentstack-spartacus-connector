import { ContentstackCmsNavigationComponentNormalizer } from './contentstack-cms-navigation-component.normalizer';
import { ContentstackEntry } from '../../model/contentstack.model';

describe('ContentstackCmsNavigationComponentNormalizer', () => {
  const normalizer = new ContentstackCmsNavigationComponentNormalizer();

  it('walks a navigation_node tree into children and leaf entries', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_footer_nav',
      _content_type_uid: 'footer_navigation_component',
      created_at: '2026-01-01T00:00:00.000Z',
      navigation_node: {
        uid: 'blt_root_node',
        _content_type_uid: 'nav_node',
        created_at: '2026-01-01T00:00:00.000Z',
        uid_val: 'RootNode',
        title: 'Footer',
        children: [
          {
            uid: 'blt_child_node',
            _content_type_uid: 'nav_node',
            created_at: '2026-01-01T00:00:00.000Z',
            uid_val: 'ChildNode',
            title: 'Support',
            entries: [
              {
                uid: 'blt_link_1',
                _content_type_uid: 'cms_link_component',
                created_at: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
      },
    };

    const component = normalizer.convert(entry);

    expect(component.navigationNode?.uid).toBe('RootNode');
    expect(component.navigationNode?.title).toBe('Footer');
    expect(component.navigationNode?.children?.length).toBe(1);
    expect(component.navigationNode?.children?.[0].uid).toBe('ChildNode');
    expect(component.navigationNode?.children?.[0].entries).toEqual([
      { itemId: 'blt_link_1', itemSuperType: 'AbstractCMSComponent', itemType: 'CMSLinkComponent' },
    ]);
  });

  it('leaves navigationNode undefined when navigation_node is unresolved or missing', () => {
    const entry: ContentstackEntry = {
      uid: 'blt_nav_2',
      _content_type_uid: 'category_navigation_component',
      created_at: '2026-01-01T00:00:00.000Z',
      navigation_node: { uid: 'blt_unresolved' },
    };

    const component = normalizer.convert(entry);

    expect(component.navigationNode).toBeUndefined();
  });

  it('unwraps a single navigation_node delivered as a one-element array', () => {
    const component = normalizer.convert({
      uid: 'blt_nav_arr',
      _content_type_uid: 'category_navigation_component',
      created_at: '2026-01-01T00:00:00.000Z',
      navigation_node: [
        {
          uid: 'blt_root',
          _content_type_uid: 'nav_node',
          created_at: '2026-01-01T00:00:00.000Z',
          uid_val: 'Root',
          title: 'Main',
        },
      ],
    });
    expect(component.navigationNode?.uid).toBe('Root');
    expect(component.navigationNode?.title).toBe('Main');
  });

  it('falls back to the system uid when uid_val is absent', () => {
    const component = normalizer.convert({
      uid: 'blt_nav_fallback',
      _content_type_uid: 'category_navigation_component',
      created_at: '2026-01-01T00:00:00.000Z',
      navigation_node: {
        uid: 'blt_sys_uid',
        _content_type_uid: 'nav_node',
        created_at: '2026-01-01T00:00:00.000Z',
        title: 'No uid_val',
      },
    });
    expect(component.navigationNode?.uid).toBe('blt_sys_uid');
  });

  it('omits children/entries keys when a node has neither', () => {
    const component = normalizer.convert({
      uid: 'blt_nav_leaf',
      _content_type_uid: 'category_navigation_component',
      created_at: '2026-01-01T00:00:00.000Z',
      navigation_node: {
        uid: 'blt_leaf',
        _content_type_uid: 'nav_node',
        created_at: '2026-01-01T00:00:00.000Z',
        uid_val: 'Leaf',
        title: 'Leaf',
      },
    });
    expect(component.navigationNode?.children).toBeUndefined();
    expect(component.navigationNode?.entries).toBeUndefined();
  });

  it('filters out unresolved references among children', () => {
    const component = normalizer.convert({
      uid: 'blt_nav_mixed',
      _content_type_uid: 'category_navigation_component',
      created_at: '2026-01-01T00:00:00.000Z',
      navigation_node: {
        uid: 'blt_root',
        _content_type_uid: 'nav_node',
        created_at: '2026-01-01T00:00:00.000Z',
        uid_val: 'Root',
        title: 'Root',
        children: [
          {
            uid: 'blt_resolved',
            _content_type_uid: 'nav_node',
            created_at: '2026-01-01T00:00:00.000Z',
            uid_val: 'Resolved',
            title: 'Resolved',
          },
          // Unresolved reference pointer (no created_at) — must be dropped.
          { uid: 'blt_unresolved' },
        ],
      },
    });
    expect(component.navigationNode?.children?.length).toBe(1);
    expect(component.navigationNode?.children?.[0].uid).toBe('Resolved');
  });

  it('derives leaf itemType from the entry content type (not hard-coded)', () => {
    const component = normalizer.convert({
      uid: 'blt_nav_customleaf',
      _content_type_uid: 'category_navigation_component',
      created_at: '2026-01-01T00:00:00.000Z',
      navigation_node: {
        uid: 'blt_root',
        _content_type_uid: 'nav_node',
        created_at: '2026-01-01T00:00:00.000Z',
        uid_val: 'Root',
        title: 'Root',
        entries: [
          {
            uid: 'blt_custom_leaf',
            _content_type_uid: 'my_custom_link',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    expect(component.navigationNode?.entries?.[0]).toEqual({
      itemId: 'blt_custom_leaf',
      itemSuperType: 'AbstractCMSComponent',
      itemType: 'my_custom_link',
    });
  });
});
