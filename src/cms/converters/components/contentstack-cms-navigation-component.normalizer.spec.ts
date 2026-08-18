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

  describe('flat (adjacency-list) all_nodes model', () => {
    // Build a resolved `nav_node_flat` entry. `link` (optional) is the uid of a
    // resolved `cms_link_component` leaf.
    const node = (
      nodeId: string,
      title: string,
      parentId: string,
      sortOrder: number,
      link?: string,
    ): ContentstackEntry => ({
      uid: `blt_${nodeId}`,
      _content_type_uid: 'nav_node_flat',
      created_at: '2026-01-01T00:00:00.000Z',
      node_id: nodeId,
      title,
      parent_id: parentId,
      sort_order: sortOrder,
      links: link
        ? [{ uid: link, _content_type_uid: 'cms_link_component', created_at: '2026-01-01T00:00:00.000Z' }]
        : [],
    });

    const flatComponent = (all_nodes: ContentstackEntry[]): ContentstackEntry => ({
      uid: 'blt_cat_nav_flat',
      _content_type_uid: 'category_navigation_flat',
      created_at: '2026-01-01T00:00:00.000Z',
      all_nodes,
    });

    it('reassembles a depth-4 tree from a flat pool by parent_id + sort_order', () => {
      const component = normalizer.convert(
        flatComponent([
          node('SafetyNavNode', 'Safety', '', 7, 'blt_safety_link'),
          node('HandToolsNavNode', 'Hand Tools', '', 6, 'blt_handtools_link'),
          node('HandToolsLinksNavNode', 'Hand Tools', 'HandToolsNavNode', 1),
          node('JigsawsNavNode', 'Jigsaws', 'HandToolsLinksNavNode', 2, 'blt_jigsaws_link'),
          node('HandSawsNavNode', 'Hand Saws', 'HandToolsLinksNavNode', 1, 'blt_handsaws_link'),
        ]),
      );

      // Top level ordered by sort_order: Hand Tools (6) before Safety (7).
      expect(component.navigationNode?.children?.map((n) => n.uid)).toEqual([
        'HandToolsNavNode',
        'SafetyNavNode',
      ]);

      const handTools = component.navigationNode?.children?.[0];
      expect(handTools?.entries).toEqual([
        { itemId: 'blt_handtools_link', itemSuperType: 'AbstractCMSComponent', itemType: 'CMSLinkComponent' },
      ]);

      // Depth 3: wrapper heading (no link) with ordered leaf children.
      const wrapper = handTools?.children?.[0];
      expect(wrapper?.uid).toBe('HandToolsLinksNavNode');
      expect(wrapper?.entries).toBeUndefined();
      expect(wrapper?.children?.map((n) => n.uid)).toEqual(['HandSawsNavNode', 'JigsawsNavNode']);
    });

    it('uses node_id as the node uid and resolves link leaves into entries', () => {
      const component = normalizer.convert(
        flatComponent([node('PowerDrillsNavNode', 'Power Drills', '', 1, 'blt_drills_link')]),
      );
      const top = component.navigationNode?.children?.[0];
      expect(top?.uid).toBe('PowerDrillsNavNode');
      expect(top?.title).toBe('Power Drills');
      expect(top?.entries?.[0].itemId).toBe('blt_drills_link');
      expect(top?.children).toBeUndefined();
    });

    it('prefers the flat model over a legacy navigation_node when both are present', () => {
      const component = normalizer.convert({
        uid: 'blt_mixed',
        _content_type_uid: 'category_navigation_flat',
        created_at: '2026-01-01T00:00:00.000Z',
        all_nodes: [node('FlatTop', 'Flat', '', 1)],
        navigation_node: {
          uid: 'blt_legacy_root',
          _content_type_uid: 'nav_node',
          created_at: '2026-01-01T00:00:00.000Z',
          uid_val: 'LegacyRoot',
          title: 'Legacy',
        },
      });
      expect(component.navigationNode?.children?.[0].uid).toBe('FlatTop');
    });

    it('drops unresolved link references among a node\'s leaves', () => {
      const withStub = node('N', 'Node', '', 1);
      withStub['links'] = [{ uid: 'blt_unresolved' }]; // no created_at → unresolved
      const component = normalizer.convert(flatComponent([withStub]));
      expect(component.navigationNode?.children?.[0].entries).toBeUndefined();
    });
  });
});
