// The service's NgRx import is ESM-only; the decorators never touch the store.
jest.mock('@ngrx/store', () => ({ Store: class {} }), { virtual: true });
// The Live Preview SDK ships ESM only; the decorators need just the empty-block class name.
jest.mock('@contentstack/live-preview-utils', () => ({
  __esModule: true,
  default: {},
  VB_EmptyBlockParentClass: 'visual-builder__empty-block-parent',
}));

import { ContentstackComponentDecorator } from './contentstack-component.decorator';
import { ContentstackSlotDecorator } from './contentstack-slot.decorator';
import { ContentstackLivePreviewService } from './contentstack-live-preview.service';
import { VB_EmptyBlockParentClass } from '@contentstack/live-preview-utils';

function fakeRenderer() {
  const attrs = new Map<string, string>();
  const classes = new Set<string>();
  return {
    attrs,
    classes,
    setAttribute: (_el: unknown, name: string, value: string) => attrs.set(name, value),
    addClass: (_el: unknown, name: string) => classes.add(name),
    removeClass: (_el: unknown, name: string) => classes.delete(name),
  };
}

/** The service with only what the decorators use; `currentCsLocale` drives retagging. */
function service(currentCsLocale?: string): ContentstackLivePreviewService {
  const svc = Object.create(
    ContentstackLivePreviewService.prototype,
  ) as ContentstackLivePreviewService;
  (svc as unknown as { currentCsLocale?: string }).currentCsLocale = currentCsLocale;
  return svc;
}

const el = {} as Element;

/** The slot decorator uses `inject()`; hand it the service directly in unit tests. */
function slotDecorator(svc = service()): ContentstackSlotDecorator {
  const d = new ContentstackSlotDecorator();
  (
    d as unknown as { contentstackLivePreviewService: ContentstackLivePreviewService }
  ).contentstackLivePreviewService = svc;
  return d;
}

describe('ContentstackComponentDecorator', () => {
  it('tags the component with its slot position', () => {
    const r = fakeRenderer();
    new ContentstackComponentDecorator(service()).decorate(el, r as never, {
      uid: 'a',
      properties: { cslp: 'landing_page.home.en-us.section1.0' },
    });
    expect(r.attrs.get('data-cslp')).toBe('landing_page.home.en-us.section1.0');
  });

  it('follows the active site locale', () => {
    const r = fakeRenderer();
    new ContentstackComponentDecorator(service('de-de')).decorate(el, r as never, {
      uid: 'a',
      properties: { cslp: 'landing_page.home.en-us.section1.2' },
    });
    expect(r.attrs.get('data-cslp')).toBe('landing_page.home.de-de.section1.2');
  });

  it('never emits a bare 3-part entry tag (Visual Builder rejects it)', () => {
    const r = fakeRenderer();
    new ContentstackComponentDecorator(service()).decorate(el, r as never, {
      uid: 'a',
      properties: { data: { uid: 'a', _content_type_uid: 'cms_paragraph_component', $: {} } },
    });
    expect(r.attrs.has('data-cslp')).toBe(false);
  });
});

describe('ContentstackSlotDecorator', () => {
  it('tags an authored slot with its reference field', () => {
    const r = fakeRenderer();
    slotDecorator().decorate(el, r as never, {
      components: [{ uid: 'a' }],
      properties: { cslp: 'landing_page.home.en-us.section1' },
    });
    expect(r.attrs.get('data-cslp')).toBe('landing_page.home.en-us.section1');
    expect(r.classes.has(VB_EmptyBlockParentClass)).toBe(false);
  });

  it('marks an empty authored slot as a Visual Builder empty block', () => {
    const r = fakeRenderer();
    slotDecorator().decorate(el, r as never, {
      components: [],
      properties: { cslp: 'landing_page.home.en-us.section2', csEmpty: true },
    });
    expect(r.classes.has(VB_EmptyBlockParentClass)).toBe(true);
  });

  it('leaves OCC slots untouched', () => {
    const r = fakeRenderer();
    slotDecorator().decorate(el, r as never, {
      components: [{ uid: 'x' }],
    });
    expect(r.attrs.size + r.classes.size).toBe(0);
  });
});
