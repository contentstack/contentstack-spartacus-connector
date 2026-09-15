import { Injectable } from '@angular/core';
import {
  CmsNavigationComponent,
  CmsNavigationEntry,
  CmsNavigationNode,
  Converter,
} from '@spartacus/core';
import { ContentstackEntry, ContentstackReference } from '../../model/contentstack.model';
import { toTypeCode } from '../../model/slot-maps';
import { isResolvedEntry } from '../../model/type-guards';

/**
 * Resolves the navigation tree carried by `category_navigation_flat`,
 * `footer_navigation_flat`, and `navigation_component` into Spartacus's
 * recursive `CmsNavigationNode` tree.
 *
 * **Flat (adjacency list) model** — the component carries an `all_nodes` pool of
 * `nav_node_flat` entries, each pointing at its parent by the plain-text
 * `parent_id` (a `node_id` value, NOT a reference). The tree is reassembled here
 * by grouping on `parent_id` and ordering by `sort_order`. Because the hierarchy
 * lives in text fields, the whole menu resolves in a constant, shallow include
 * chain (`<field>.all_nodes` + `.all_nodes.links`) no matter how deep it nests —
 * the Delivery API's plan-gated reference-depth cap never applies.
 *
 * Each node's `links` resolve into leaf `CmsNavigationEntry` items (the linked
 * `cms_link_component` references).
 */
@Injectable({ providedIn: 'root' })
export class ContentstackCmsNavigationComponentNormalizer implements Converter<
  ContentstackEntry,
  CmsNavigationComponent
> {
  convert(source: ContentstackEntry, target: CmsNavigationComponent = {}): CmsNavigationComponent {
    // Flat adjacency-list model (`all_nodes` pool): reassemble the tree from it.
    const flatNodes = this.resolvedList(source['all_nodes']);
    if (flatNodes.length) {
      target.navigationNode = this.buildFromFlat(flatNodes, source.uid ?? 'NavigationNode');
    }
    return target;
  }

  /**
   * Reassemble a flat `nav_node_flat` pool into a `CmsNavigationNode` tree.
   * Top-level nodes are those with an empty (or absent) `parent_id`; every other
   * node hangs under the node whose `node_id` equals its `parent_id`. Siblings
   * are ordered by `sort_order`. A synthetic root (`rootUid`) holds the
   * top-level nodes, matching the single-root shape Spartacus expects.
   */
  private buildFromFlat(nodes: ContentstackEntry[], rootUid: string): CmsNavigationNode {
    // Guard against malformed authoring data: a duplicated `node_id`, a node that
    // names itself as its own parent, or a parent/child cycle. Any of these would
    // otherwise spawn duplicate subtrees or recurse forever (stack overflow).

    // 1) Dedupe by node_id (first wins), so a duplicated id can't produce two
    //    conflicting nodes or an ambiguous parent lookup.
    const byId = new Map<string, ContentstackEntry>();
    for (const n of nodes) {
      const id = this.nodeId(n);
      if (!byId.has(id)) {
        byId.set(id, n);
      }
    }

    // 2) Group by parent. A node whose parent_id equals its own node_id is
    //    self-referencing — treat it as top-level rather than let it parent
    //    itself (which would recurse infinitely).
    const byParent = new Map<string, ContentstackEntry[]>();
    for (const n of byId.values()) {
      const key = this.parentKey(n) === this.nodeId(n) ? '' : this.parentKey(n);
      const siblings = byParent.get(key) ?? [];
      siblings.push(n);
      byParent.set(key, siblings);
    }
    for (const siblings of byParent.values()) {
      siblings.sort((a, b) => this.sortOrder(a) - this.sortOrder(b));
    }

    // 3) Build recursively, carrying the set of ancestor ids on the current path.
    //    A node whose id is already an ancestor closes a cycle — stop descending
    //    (a fully cyclic pool simply yields no top-level nodes, i.e. an empty menu).
    const build = (parentKey: string, ancestors: Set<string>): CmsNavigationNode[] =>
      (byParent.get(parentKey) ?? []).map((n) => {
        const nodeId = this.nodeId(n);
        const node: CmsNavigationNode = { uid: nodeId, title: n['title'] as string };

        const links = this.resolvedList(n['links']);
        if (links.length) {
          node.entries = links.map((linkEntry) => this.toNavigationEntry(linkEntry));
        }
        if (!ancestors.has(nodeId)) {
          const children = build(nodeId, new Set(ancestors).add(nodeId));
          if (children.length) {
            node.children = children;
          }
        }
        return node;
      });

    return { uid: rootUid, children: build('', new Set()) };
  }

  /** A node's identity: its `node_id`, falling back to the entry uid. */
  private nodeId(node: ContentstackEntry): string {
    return (node['node_id'] as string) ?? node.uid;
  }

  /** The parent grouping key: a node's `parent_id`, normalized to '' for top level. */
  private parentKey(node: ContentstackEntry): string {
    const parent = node['parent_id'];
    return typeof parent === 'string' && parent.length ? parent : '';
  }

  /** Numeric `sort_order` (tolerates string/undefined), defaulting to 0. */
  private sortOrder(node: ContentstackEntry): number {
    const value = node['sort_order'];
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private toNavigationEntry(entry: ContentstackEntry): CmsNavigationEntry {
    const itemType = toTypeCode(entry._content_type_uid);
    return {
      itemId: entry.uid,
      itemSuperType: 'AbstractCMSComponent',
      itemType,
    };
  }

  private resolvedList(value: unknown): ContentstackEntry[] {
    const list = Array.isArray(value) ? value : [];
    return list.filter((item): item is ContentstackEntry =>
      isResolvedEntry(item as ContentstackReference),
    );
  }
}
