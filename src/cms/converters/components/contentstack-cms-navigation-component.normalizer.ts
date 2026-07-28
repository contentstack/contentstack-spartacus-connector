import { Injectable } from '@angular/core';
import {
  CmsNavigationComponent,
  CmsNavigationEntry,
  CmsNavigationNode,
  Converter,
} from '@spartacus/core';
import { ContentstackEntry, ContentstackReference } from '../../model/contentstack.model';
import { toTypeCode } from '../../model/slot-maps';
import { isNavigationNode, isResolvedEntry } from '../../model/type-guards';

/**
 * Resolves the `navigation_node` reference shared by `category_navigation_component`,
 * `footer_navigation_component`, and `navigation_component` into Spartacus's
 * recursive `CmsNavigationNode` tree via a `nav_node` walk: `children` recurse
 * into further nodes, `entries` resolve into leaf `CmsNavigationEntry` items
 * (here, always `cms_link_component` references — the only leaf type the
 * starter-pack schema links).
 *
 * `nav_node.uid_val` (renamed from the reserved `uid` field name) carries the
 * SAP-meaningful node id; Contentstack's own system `uid` is unrelated.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackCmsNavigationComponentNormalizer
  implements Converter<ContentstackEntry, CmsNavigationComponent>
{
  convert(
    source: ContentstackEntry,
    target: CmsNavigationComponent = {}
  ): CmsNavigationComponent {
    // Contentstack delivers reference fields as arrays even for a single
    // reference, so unwrap `[rootNode]` before resolving the tree.
    const raw = source['navigation_node'];
    const node = (Array.isArray(raw) ? raw[0] : raw) as
      | ContentstackReference
      | undefined;
    if (isNavigationNode(node)) {
      target.navigationNode = this.toNavigationNode(node);
    }
    return target;
  }

  private toNavigationNode(entry: ContentstackEntry): CmsNavigationNode {
    const node: CmsNavigationNode = {
      uid: (entry['uid_val'] as string | undefined) ?? entry.uid,
      title: entry.title,
    };

    const children = this.resolvedList(entry['children']);
    if (children.length) {
      node.children = children
        .filter(isNavigationNode)
        .map((child) => this.toNavigationNode(child));
    }

    const entries = this.resolvedList(entry['entries']);
    if (entries.length) {
      node.entries = entries.map((linkEntry) => this.toNavigationEntry(linkEntry));
    }

    return node;
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
      isResolvedEntry(item as ContentstackReference)
    );
  }
}
