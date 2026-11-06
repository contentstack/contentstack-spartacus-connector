import { CmsComponent, CmsStructureModel, ContentSlotData, Page } from '@spartacus/core';

/**
 * Layered per-slot merge of `CmsStructureModel`s for the hybrid rendering model.
 *
 * Layers are ordered **lowest precedence first**: the OCC base page, then the
 * shared `global_slots` shell, then the Contentstack page. For each SAP slot
 * position, the highest layer that defines it wins (so an authored Contentstack
 * slot overrides OCC; an unauthored slot falls through to OCC). This is the
 * generalization of the old `mergeGlobalSlots` — the base is now the OCC page
 * instead of "empty".
 *
 * Rules:
 *  - **slots**: last layer to define a slot name wins (whole-slot replace).
 *  - **components**: union of all layers, deduped by `uid` (later layer wins on
 *    a uid collision); uid-less components are kept as-is.
 *  - **page metadata**: later layers override earlier for editorial/SEO fields
 *    (title, name, description, robots, label), but `template`/`type`/`pageId`
 *    are pinned to the **base** layer when it provides them — the base template
 *    defines the slot layout, so a Contentstack override must not change it.
 *
 * Pure and framework-free (types only) so it is unit-testable in isolation.
 * Returns `{}` when no layer carries content.
 */
export function mergeStructures(
  base: CmsStructureModel | undefined,
  ...overrides: (CmsStructureModel | undefined)[]
): CmsStructureModel {
  const layers = [base, ...overrides].filter((l): l is CmsStructureModel => !!l);
  if (!layers.length) {
    return {};
  }

  // Slots — later layer wins per slot name. Exception: an authored-but-empty
  // Contentstack slot (`csEmpty`, emitted only in Live Preview so Visual Builder
  // can offer "add" on it) never replaces a lower layer's non-empty slot. That
  // slot stays exactly as OCC rendered it, untagged: functional slots such as
  // the language switcher or sign-in links must not invite an editor to
  // override them from Visual Builder.
  const slots: Record<string, ContentSlotData> = {};
  for (const layer of layers) {
    for (const [name, data] of Object.entries(layer.page?.slots ?? {})) {
      if (data?.properties?.csEmpty && slots[name]?.components?.length) {
        continue;
      }
      slots[name] = data;
    }
  }

  // Components — union deduped by uid (later wins), uid-less appended.
  const byUid = new Map<string, CmsComponent>();
  const noUid: CmsComponent[] = [];
  for (const layer of layers) {
    for (const c of layer.components ?? []) {
      if (c && typeof c.uid === 'string') {
        byUid.set(c.uid, c);
      } else if (c) {
        noUid.push(c);
      }
    }
  }
  const components = [...byUid.values(), ...noUid];

  // Page metadata — later layers override earlier; base pins the structural
  // fields (template/type/pageId) that determine the slot layout.
  const page: Page = {};
  for (const layer of layers) {
    if (!layer.page) {
      continue;
    }
    for (const [k, v] of Object.entries(layer.page)) {
      if (k === 'slots' || v === undefined) {
        continue;
      }
      (page as Record<string, unknown>)[k] = v;
    }
  }
  if (base?.page) {
    for (const key of ['template', 'type', 'pageId'] as const) {
      if (base.page[key] != null) {
        (page as Record<string, unknown>)[key] = base.page[key];
      }
    }
  }
  page.slots = slots;

  return { page, components };
}
