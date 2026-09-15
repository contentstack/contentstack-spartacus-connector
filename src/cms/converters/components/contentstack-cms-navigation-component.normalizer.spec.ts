import { ContentstackCmsNavigationComponentNormalizer } from './contentstack-cms-navigation-component.normalizer';
import { ContentstackEntry } from '../../model/contentstack.model';

describe('ContentstackCmsNavigationComponentNormalizer', () => {
  const normalizer = new ContentstackCmsNavigationComponentNormalizer();

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
      ? [
          {
            uid: link,
            _content_type_uid: 'cms_link_component',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ]
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
      {
        itemId: 'blt_handtools_link',
        itemSuperType: 'AbstractCMSComponent',
        itemType: 'CMSLinkComponent',
      },
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

  it('derives leaf itemType from the entry content type (not hard-coded)', () => {
    const customLink = node('Root', 'Root', '', 1);
    customLink['links'] = [
      {
        uid: 'blt_custom_leaf',
        _content_type_uid: 'my_custom_link',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    const component = normalizer.convert(flatComponent([customLink]));
    expect(component.navigationNode?.children?.[0].entries?.[0]).toEqual({
      itemId: 'blt_custom_leaf',
      itemSuperType: 'AbstractCMSComponent',
      itemType: 'my_custom_link',
    });
  });

  it('leaves navigationNode undefined when all_nodes is empty or missing', () => {
    expect(normalizer.convert(flatComponent([])).navigationNode).toBeUndefined();
    expect(
      normalizer.convert({
        uid: 'blt_no_nodes',
        _content_type_uid: 'category_navigation_flat',
        created_at: '2026-01-01T00:00:00.000Z',
      }).navigationNode,
    ).toBeUndefined();
  });

  it('ignores a stray legacy navigation_node field and uses all_nodes', () => {
    const component = normalizer.convert({
      uid: 'blt_mixed',
      _content_type_uid: 'category_navigation_flat',
      created_at: '2026-01-01T00:00:00.000Z',
      all_nodes: [node('FlatTop', 'Flat', '', 1)],
      // A leftover recursive field must not be read — the flat pool wins.
      navigation_node: {
        uid: 'blt_legacy_root',
        _content_type_uid: 'nav_node',
        created_at: '2026-01-01T00:00:00.000Z',
        title: 'Legacy',
      },
    });
    expect(component.navigationNode?.children?.map((n) => n.uid)).toEqual(['FlatTop']);
  });

  it("drops unresolved link references among a node's leaves", () => {
    const withStub = node('N', 'Node', '', 1);
    withStub['links'] = [{ uid: 'blt_unresolved' }]; // no created_at → unresolved
    const component = normalizer.convert(flatComponent([withStub]));
    expect(component.navigationNode?.children?.[0].entries).toBeUndefined();
  });

  describe('malformed-data guards (no infinite recursion)', () => {
    it('treats a self-referencing node (parent_id === node_id) as top-level', () => {
      const build = () => normalizer.convert(flatComponent([node('Solo', 'Solo', 'Solo', 1)]));
      // Must not recurse forever: complete and surface the node once, at the top.
      const component = build();
      expect(component.navigationNode?.children?.map((n) => n.uid)).toEqual(['Solo']);
      expect(component.navigationNode?.children?.[0].children).toBeUndefined();
    });

    it('does not hang on a parent/child cycle (A→B→A); a pure cycle yields no roots', () => {
      const component = normalizer.convert(
        flatComponent([node('A', 'A', 'B', 1), node('B', 'B', 'A', 1)]),
      );
      // Neither node is top-level (each names the other as parent), so the menu is
      // empty — the point is that it terminates instead of overflowing the stack.
      expect(component.navigationNode?.children).toEqual([]);
    });

    it('deduplicates a repeated node_id (first wins) rather than duplicating a subtree', () => {
      const component = normalizer.convert(
        flatComponent([
          node('Dup', 'First', '', 1, 'blt_first_link'),
          node('Dup', 'Second', '', 2, 'blt_second_link'),
          node('Child', 'Child', 'Dup', 1),
        ]),
      );
      const tops = component.navigationNode?.children ?? [];
      expect(tops.map((n) => n.uid)).toEqual(['Dup']); // only one 'Dup', not two
      expect(tops[0].title).toBe('First'); // first occurrence wins
      expect(tops[0].children?.map((n) => n.uid)).toEqual(['Child']);
    });

    it('does not let an empty node_id adopt every root node as its children', () => {
      const component = normalizer.convert(
        flatComponent([node('', 'Empty', '', 1), node('Real', 'Real', '', 2)]),
      );
      const tops = component.navigationNode?.children ?? [];
      // Both are top-level; the empty-id node must NOT pull the other roots under it.
      expect(tops.map((n) => n.uid)).toEqual(['', 'Real']);
      expect(tops.find((n) => n.uid === '')?.children).toBeUndefined();
    });

    it('guards a deeper cycle reachable from a real root without hanging', () => {
      // Root → Mid, and a stray pair (X→Y→X) that must not be walked into forever.
      const component = normalizer.convert(
        flatComponent([
          node('Root', 'Root', '', 1),
          node('Mid', 'Mid', 'Root', 1),
          node('X', 'X', 'Y', 1),
          node('Y', 'Y', 'X', 1),
        ]),
      );
      expect(component.navigationNode?.children?.map((n) => n.uid)).toEqual(['Root']);
      expect(component.navigationNode?.children?.[0].children?.map((n) => n.uid)).toEqual(['Mid']);
    });
  });
});
