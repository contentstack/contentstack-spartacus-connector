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
});
