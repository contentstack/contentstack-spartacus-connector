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
    const byParent = new Map<string, ContentstackEntry[]>();
    for (const n of nodes) {
      const key = this.parentKey(n);
      const siblings = byParent.get(key) ?? [];
      siblings.push(n);
      byParent.set(key, siblings);
    }
    for (const siblings of byParent.values()) {
      siblings.sort((a, b) => this.sortOrder(a) - this.sortOrder(b));
    }

    const build = (parentKey: string): CmsNavigationNode[] =>
      (byParent.get(parentKey) ?? []).map((n) => {
        const nodeId = (n['node_id'] as string) ?? n.uid;
        const node: CmsNavigationNode = { uid: nodeId, title: n['title'] as string };

        const links = this.resolvedList(n['links']);
        if (links.length) {
          node.entries = links.map((linkEntry) => this.toNavigationEntry(linkEntry));
        }
        const children = build(nodeId);
        if (children.length) {
          node.children = children;
        }
        return node;
      });

    return { uid: rootUid, children: build('') };
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
