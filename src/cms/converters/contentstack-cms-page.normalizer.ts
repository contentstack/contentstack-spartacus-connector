import { Injectable } from '@angular/core';
import {
  CmsComponent,
  CmsStructureModel,
  Converter,
  ContentSlotComponentData,
  ContentSlotData,
  Page,
  PageRobotsMeta,
  PageType,
} from '@spartacus/core';
import { ContentstackConfig } from '../../config/contentstack-config';
import {
  ContentstackCmsPageEntry,
  ContentstackEntry,
} from '../model/contentstack.model';
import { effectiveSlotMap, resolveFlexType, toTypeCode } from '../model/slot-maps';
import { ContentstackCmsComponentNormalizer } from './contentstack-cms-component.normalizer';

/**
 * Translates a raw Contentstack `cms_page` entry (Content Model Starter Pack /
 * EP2 shipped schema) into Spartacus's native `CmsStructureModel` (`page` +
 * flat `components[]`). Because we normalize into the model Spartacus already
 * renders, the stock rendering engine (PageLayoutComponent → PageSlotComponent
 * → ComponentWrapperDirective) draws Contentstack content with no forked
 * renderer.
 *
 * EP2's `cms_page` models slots as **named per-slot multi-reference fields**
 * (`section1`, `section2_a`, `body_content`, … + `header`/`footer`), each
 * referencing separate component-type entries. Slot discovery is driven by
 * `SLOT_FIELD_TO_SAP_NAME` (see `slot-maps.ts`): the normalizer reads only the
 * fields enumerated there, maps each to its SAP slot position name, and maps
 * each referenced entry's content-type uid to its SAP typecode. This is an
 * allowlist — any field NOT in the map is ignored, so page-level scalars /
 * metadata can never be mistaken for a slot (a field uid could only ever render
 * as a slot if it maps to a real SAP layout position anyway). This replaced an
 * earlier single-`modular_blocks`-field model — see DECISIONS.md D3.
 *
 * Shape mapping:
 *   Contentstack                          Spartacus
 *   ------------------------------------  ------------------------------------
 *   entry.uid                             page.pageId
 *   entry.title                           page.title / page.name
 *   entry.<slugField>                     page.label
 *   entry.description                     page.description
 *   entry.robots                          page.robots (PageRobotsMeta[])
 *   entry.template                        page.template
 *   entry.type / entry.page_type          page.type (SAP page-type discriminator)
 *   entry.<slotField> (array of refs)     page.slots[SAP slot name].components[]
 *   each referenced component entry       ContentSlotComponentData + CmsComponent
 *   referenced entry._content_type_uid    typeCode (→ SAP typecode → CmsConfig.cmsComponents key)
 */
@Injectable({ providedIn: 'root' })
export class ContentstackCmsPageNormalizer
  implements Converter<ContentstackCmsPageEntry, CmsStructureModel>
{
  constructor(
    protected config: ContentstackConfig,
    protected componentNormalizer: ContentstackCmsComponentNormalizer
  ) {}

  convert(
    source: ContentstackCmsPageEntry,
    target: CmsStructureModel = {}
  ): CmsStructureModel {
    const { slots, components } = this.buildStructure(source);

    const page: Page = {
      pageId: source.uid,
      name: source.title,
      title: source.title,
      type: this.resolvePageType(source),
      template: source.template,
      slots,
    };

    const label = this.resolveLabel(source);
    if (label) {
      page.label = label;
    }
    const description = source.description;
    if (typeof description === 'string') {
      page.description = description;
    }
    const robots = this.resolveRobots(source);
    if (robots.length) {
      page.robots = robots;
    }

    target.page = page;
    target.components = components;
    return target;
  }

  /**
   * Walk an entry's named per-slot reference fields into a slot map + flat
   * component list. Driven by `SLOT_FIELD_TO_SAP_NAME` (allowlist). Shared by
   * {@link convert} (pages) and the global-slots merge (the shared
   * header/footer/nav entry, merged by the page adapter), so both go through the
   * same field→slot / content-type→typecode resolution path.
   */
  buildStructure(source: ContentstackCmsPageEntry): {
    slots: { [key: string]: ContentSlotData };
    components: CmsComponent[];
  } {
    const slots: { [key: string]: ContentSlotData } = {};
    const components: CmsComponent[] = [];

    const slotMap = effectiveSlotMap(this.config.contentstack?.additionalSlotFields);
    for (const [fieldUid, slotName] of Object.entries(slotMap)) {
      const entries = this.resolvedEntries(source[fieldUid]);
      if (!entries.length) {
        continue;
      }

      const slotComponents: ContentSlotComponentData[] = [];
      for (const entry of entries) {
        const typeCode = toTypeCode(entry._content_type_uid);
        // Some components need a STABLE SAP uid rather than the Contentstack
        // entry uid: the tab container's uid drives Spartacus's tab-label i18n
        // key (`${container.uid}.tabs.${tab.uid}`), which only resolves against
        // the stock uid (e.g. `TabPanelContainer`). Honor an optional
        // `component_uid` field carrying that stable uid.
        const stableUid = (entry as Record<string, unknown>)['component_uid'] as string | undefined;
        const compUid = typeCode === 'CMSTabParagraphContainer' && stableUid ? stableUid : entry.uid;
        slotComponents.push({
          uid: compUid,
          typeCode,
          // Spartacus picks the Angular component from `flexType` — for a
          // `CMSFlexComponent` that MUST be the real subtype (e.g.
          // `ProductIntroComponent`), not the literal `CMSFlexComponent`.
          flexType: resolveFlexType(entry as Record<string, unknown>, typeCode),
          properties: entry.$ ? { data: entry } : undefined,
        });
        const component = this.componentNormalizer.convert(entry);
        if (compUid !== entry.uid) {
          (component as { uid?: string }).uid = compUid;
        }
        components.push(component);

        // Tab container references child tab components by id; emit them into
        // components[] (the regular CMS store) so the stock
        // TabParagraphContainer resolves each via getComponentData without a
        // separate fetch.
        if (typeCode === 'CMSTabParagraphContainer') {
          components.push(
            ...this.expandContainer(
              component,
              (entry as Record<string, unknown>)['tab_components']
            )
          );
        }
      }
      slots[slotName] = { components: slotComponents };
    }

    return { slots, components };
  }

  /**
   * Returns the resolved component entries held by a reference field value.
   * Handles both multi-reference (array) and single-reference (header/footer)
   * shapes, and tolerates unresolved references (uid-only) by still emitting a
   * component shell so Spartacus can request it via the component adapter.
   */
  protected resolvedEntries(value: unknown): ContentstackEntry[] {
    const list = Array.isArray(value) ? value : value != null ? [value] : [];
    return list.filter(
      (item): item is ContentstackEntry =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { uid?: unknown }).uid === 'string'
    );
  }

  /**
   * Build the page's `label` (canonical path) from the configured slug field
   * (default `url`), normalized to a leading slash. Matches how Spartacus/OCC
   * populate `page.label`; the homepage slug `/` is preserved as-is.
   */
  protected resolveLabel(source: ContentstackCmsPageEntry): string | undefined {
    const slugField = this.config.contentstack?.slugField ?? 'url';
    const raw = source[slugField] ?? source.url;
    if (typeof raw !== 'string' || !raw) {
      return undefined;
    }
    if (raw === '/') {
      return '/';
    }
    return raw.startsWith('/') ? raw : `/${raw}`;
  }

  /**
   * Map the entry's `robots` string to Spartacus's `PageRobotsMeta[]`. Mirrors
   * the Spartacus/OCC mapping; an absent or unrecognized value yields `[]`
   * (robots meta omitted).
   */
  protected resolveRobots(source: ContentstackCmsPageEntry): PageRobotsMeta[] {
    switch (source['robots']) {
      case 'index, follow':
        return [PageRobotsMeta.INDEX, PageRobotsMeta.FOLLOW];
      case 'noindex':
        return [PageRobotsMeta.NOINDEX, PageRobotsMeta.FOLLOW];
      case 'nofollow':
        return [PageRobotsMeta.INDEX, PageRobotsMeta.NOFOLLOW];
      case 'noindex, nofollow':
        return [PageRobotsMeta.NOINDEX, PageRobotsMeta.NOFOLLOW];
      default:
        return [];
    }
  }

  /**
   * Expand a tab/paragraph container. `tab_components` is a JSON array of
   * `{ uid, type_code? }`; each becomes a child `CmsComponent` (functional
   * component that hydrates from OCC — no editorial data) and the container's
   * `components` field is set to the space-separated child uids, matching the
   * shape the stock `TabParagraphContainerComponent` reads. Mutates `container`
   * in place and returns the child components.
   */
  protected expandContainer(
    container: CmsComponent,
    rawTabs: unknown
  ): CmsComponent[] {
    const tabs = this.parseJsonArray(rawTabs);
    const children: CmsComponent[] = [];
    const uids: string[] = [];
    for (const tab of tabs) {
      const childUid = (tab['uid'] ?? tab['type_code']) as string | undefined;
      if (!childUid) {
        continue;
      }
      uids.push(childUid);
      children.push({
        uid: childUid,
        typeCode: (tab['type_code'] as string) ?? childUid,
        flexType: (tab['type_code'] as string) ?? childUid,
      } as CmsComponent);
    }
    (container as Record<string, unknown>)['components'] = uids.join(' ');
    return children;
  }

  /** Parse a JSON-string (or already-parsed) array of objects; [] on failure. */
  protected parseJsonArray(raw: unknown): Array<Record<string, unknown>> {
    let value = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  }

  /**
   * Resolve the Spartacus `PageType`. EP2's `cms_page` carries a `type` field
   * whose values (`ContentPage`/`ProductPage`/`CategoryPage`/`CatalogPage`)
   * align 1:1 with the `PageType` enum, so it's used directly when present; the
   * product/category-page work also authors this discriminator as `page_type`,
   * so that field is accepted as a fallback. Falls back to the optional
   * `pageTypeMapping` config (by content-type uid), then to `CONTENT_PAGE`.
   */
  protected resolvePageType(source: ContentstackCmsPageEntry): PageType {
    const declared =
      source.type ?? (source as Record<string, unknown>)['page_type'];
    if (
      typeof declared === 'string' &&
      (Object.values(PageType) as string[]).includes(declared)
    ) {
      return declared as PageType;
    }
    const mapping = this.config.contentstack?.pageTypeMapping;
    if (mapping) {
      for (const [pageType, map] of Object.entries(mapping)) {
        if (map?.contentTypeUid === source._content_type_uid) {
          return pageType as PageType;
        }
      }
    }
    return PageType.CONTENT_PAGE;
  }
}
