import { Injectable } from '@angular/core';
import { resolveFlexType } from '../model/slot-maps';

/**
 * Translates a Contentstack block's author-friendly fields into the exact field
 * names/shapes the **stock** Spartacus CMS components read from their
 * `CmsComponentData`. Centralizing this here keeps the OOTB contract knowledge
 * in one place and lets Contentstack authors use clean field names
 * (`image_url`, `link_name`, …) instead of mirroring OCC's payload.
 *
 * Only content-bearing fields are mapped; the normalizer owns `uid`/`typeCode`
 * and (for navigation) the `navigationNode` tree. Unknown types fall through as
 * a raw passthrough so new block types render without a code change if their
 * field names already match the OOTB component.
 */
@Injectable({ providedIn: 'root' })
export class ContentstackFieldMapper {
  /**
   * @param typeCode the resolved Spartacus typeCode (e.g. `CMSLinkComponent`)
   * @param fields   the block's content fields (internal keys already stripped)
   */
  map(typeCode: string, fields: Record<string, unknown>): Record<string, unknown> {
    switch (typeCode) {
      case 'SimpleResponsiveBannerComponent':
      case 'SimpleBannerComponent':
      case 'BannerComponent':
        return this.banner(fields);
      case 'CMSLinkComponent':
        return this.link(fields);
      case 'CMSParagraphComponent':
        return { content: fields['content'] ?? '' };
      case 'ProductCarouselComponent':
        return {
          title: fields['cms_title'] ?? fields['title'] ?? '',
          productCodes: fields['product_codes'] ?? fields['productCodes'] ?? '',
          scroll: fields['scroll'] ?? 'ALLVISIBLE',
          popup: String(fields['popup'] ?? 'false'),
        };
      case 'SearchBoxComponent':
        return {
          maxProducts: String(fields['max_products'] ?? 5),
          maxSuggestions: String(fields['max_suggestions'] ?? 5),
          displayProducts: String(fields['display_products'] ?? 'true'),
          displaySuggestions: String(fields['display_suggestions'] ?? 'true'),
          displayProductImages: String(fields['display_product_images'] ?? 'true'),
          minCharactersBeforeRequest: String(fields['min_characters_before_request'] ?? 3),
          waitTimeBeforeRequest: String(fields['wait_time_before_request'] ?? 500),
        };
      case 'CMSFlexComponent':
        return { flexType: resolveFlexType(fields, 'CMSFlexComponent') };
      case 'CMSSiteContextComponent':
        return { context: fields['context'] };
      case 'ProductReferencesComponent':
        return {
          title: fields['cms_title'] ?? fields['title'] ?? '',
          productReferenceTypes:
            fields['reference_types'] ?? fields['productReferenceTypes'] ?? 'SIMILAR',
          maximumNumberProducts: String(
            fields['max_products'] ?? fields['maximumNumberProducts'] ?? 5,
          ),
          displayProductTitles: String(fields['display_product_titles'] ?? 'true'),
          displayProductPrices: String(fields['display_product_prices'] ?? 'true'),
        };
      default:
        // Passthrough: block field names already match the OOTB component.
        return this.stripAuthoringKeys(fields);
    }
  }

  /** Build a Spartacus media Image object from an absolute image URL + alt. */
  protected banner(fields: Record<string, unknown>): Record<string, unknown> {
    const url = (fields['image_url'] ?? fields['url']) as string | undefined;
    const alt = (fields['alt_text'] ?? fields['altText'] ?? fields['name']) as string | undefined;
    const out: Record<string, unknown> = {
      urlLink: fields['url_link'] ?? fields['urlLink'] ?? '',
    };
    if (fields['name']) {
      out['name'] = fields['name'];
    }
    // MediaService reads `.url` (single Image container) and leaves absolute
    // http(s) URLs untouched — no OCC media baseUrl prefixing.
    if (url) {
      out['media'] = { url, altText: alt ?? '' };
    }
    return out;
  }

  protected link(fields: Record<string, unknown>): Record<string, unknown> {
    return {
      linkName: fields['link_name'] ?? fields['linkName'] ?? '',
      url: fields['url_link'] ?? fields['url'] ?? '',
      target: String(fields['target'] ?? 'false'),
    };
  }

  /** Drop our authoring-only keys so a passthrough doesn't leak them. */
  protected stripAuthoringKeys(fields: Record<string, unknown>): Record<string, unknown> {
    const { type_code, slot, tab_components, ...rest } = fields as Record<string, unknown>;
    return rest;
  }
}
