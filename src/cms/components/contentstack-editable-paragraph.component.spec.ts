import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { CmsComponentData } from '@spartacus/storefront';
import {
  ContentstackEditableParagraphComponent,
  ContentstackEditableParagraphData,
} from './contentstack-editable-paragraph.component';

/**
 * Component-level coverage for the core Visual Builder fix: the rendered
 * paragraph must carry a field-level `data-cslp` when the entry was tagged
 * (preview), and NONE when it was not (delivery). The normalizer specs only
 * assert data propagation, so this guards the template binding + directive.
 */
describe('ContentstackEditableParagraphComponent', () => {
  const TAG = 'cms_paragraph_component.blt1.en-us.content';

  const router = { navigateByUrl: jest.fn().mockResolvedValue(true) };

  async function render(
    data: ContentstackEditableParagraphData,
  ): Promise<ComponentFixture<ContentstackEditableParagraphComponent>> {
    await TestBed.configureTestingModule({
      imports: [ContentstackEditableParagraphComponent],
      providers: [
        { provide: CmsComponentData, useValue: { uid: 'blt1', data$: of(data) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ContentstackEditableParagraphComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    router.navigateByUrl.mockClear();
  });

  it('emits the 4-part field-level data-cslp and renders the content when tagged (preview)', async () => {
    const fixture = await render({
      content: '<p>Hello</p>',
      $: { content: { 'data-cslp': TAG } },
    });
    const el = fixture.nativeElement.querySelector('.cx-paragraph') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.getAttribute('data-cslp')).toBe(TAG);
    expect(el.innerHTML).toContain('<p>Hello</p>');
  });

  it('renders no data-cslp attribute when the entry is untagged (delivery)', async () => {
    const fixture = await render({ content: '<p>Hello</p>' });
    const el = fixture.nativeElement.querySelector('.cx-paragraph') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.hasAttribute('data-cslp')).toBe(false);
    expect(el.innerHTML).toContain('<p>Hello</p>');
  });

  describe('CMSTabParagraphComponent entries (TC-5)', () => {
    const TAB_TAG = 'cms_tab_paragraph_component.blt2.en-us.content';

    it('emits the field-level data-cslp for a tagged tab paragraph (preview)', async () => {
      const fixture = await render({
        content: '<p>Tab body</p>',
        $: { content: { 'data-cslp': TAB_TAG } },
      });
      const el = fixture.nativeElement.querySelector('.cx-paragraph') as HTMLElement;
      expect(el.getAttribute('data-cslp')).toBe(TAB_TAG);
      expect(el.innerHTML).toContain('<p>Tab body</p>');
    });

    it('renders no data-cslp for an untagged tab paragraph (delivery)', async () => {
      const fixture = await render({ content: '<p>Tab body</p>' });
      const el = fixture.nativeElement.querySelector('.cx-paragraph') as HTMLElement;
      expect(el.hasAttribute('data-cslp')).toBe(false);
      expect(el.innerHTML).toContain('<p>Tab body</p>');
    });
  });

  describe('editor HTML sanitization (TC-6)', () => {
    it('keeps editor formatting while removing active and unsafe markup', async () => {
      const fixture = await render({
        content:
          '<h2 class="intro-title">Heading</h2>' +
          '<p><strong>Bold</strong> <em>italic</em></p>' +
          '<ul><li>One</li></ul>' +
          '<table><tbody><tr><td>Cell</td></tr></tbody></table>' +
          '<p><a href="/help">Help</a></p>' +
          '<style>p { color: red; }</style>' +
          '<iframe src="https://evil.example"></iframe>' +
          '<script>window.pwned = true;</script>' +
          '<img src="x" onerror="alert(1)">' +
          '<p style="color: red" onclick="alert(1)">Styled</p>' +
          '<a href="javascript:alert(1)">Bad link</a>',
      });
      const el = fixture.nativeElement.querySelector('.cx-paragraph') as HTMLElement;

      // Kept: editor formatting.
      expect(el.querySelector('h2.intro-title')?.textContent).toBe('Heading');
      expect(el.querySelector('strong')?.textContent).toBe('Bold');
      expect(el.querySelector('em')?.textContent).toBe('italic');
      expect(el.querySelector('ul > li')?.textContent).toBe('One');
      expect(el.querySelector('table td')?.textContent).toBe('Cell');
      expect(el.querySelector('a[href="/help"]')?.textContent).toBe('Help');

      // Removed: style, iframe, script, inline handlers, style attributes and javascript: URLs.
      expect(el.querySelector('style')).toBeNull();
      expect(el.querySelector('iframe')).toBeNull();
      expect(el.querySelector('script')).toBeNull();
      expect(el.querySelector('img')?.hasAttribute('onerror')).toBeFalsy();
      expect(el.querySelector('p[onclick]')).toBeNull();
      expect(el.querySelector('[style]')).toBeNull();
      // Angular's sanitizer neutralises the javascript: URL by prefixing it with `unsafe:`.
      const badLink = Array.from(el.querySelectorAll('a')).find(
        (a) => a.textContent === 'Bad link',
      );
      expect(badLink?.getAttribute('href')).toMatch(/^unsafe:/);
      expect(el.querySelector('a[href^="javascript:"]')).toBeNull();
      expect((window as unknown as { pwned?: boolean }).pwned).toBeUndefined();
    });
  });

  describe('empty content (TC-7)', () => {
    it('renders an empty .cx-paragraph when Content is empty', async () => {
      const fixture = await render({ content: '' });
      const el = fixture.nativeElement.querySelector('.cx-paragraph') as HTMLElement;
      expect(el).toBeTruthy();
      expect(el.innerHTML.trim()).toBe('');
    });

    it('renders an empty .cx-paragraph when Content is missing', async () => {
      const fixture = await render({});
      const el = fixture.nativeElement.querySelector('.cx-paragraph') as HTMLElement;
      expect(el).toBeTruthy();
      expect(el.innerHTML.trim()).toBe('');
    });
  });

  describe('links and anchors (DX-31581, TC-22)', () => {
    const click = (el: Element, init: MouseEventInit = {}): MouseEvent => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
      el.dispatchEvent(event);
      return event;
    };

    it('routes a root-relative link in-app instead of reloading the page', async () => {
      const fixture = await render({ content: '<p><a href="/cart">Cart</a></p>' });
      const event = click(fixture.nativeElement.querySelector('a'));
      expect(event.defaultPrevented).toBe(true);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/cart');
    });

    it('leaves external links, new-tab links and modified clicks to the browser', async () => {
      const fixture = await render({
        content:
          '<a href="https://example.com">Ext</a>' +
          '<a href="/cart" target="_blank">Tab</a>' +
          '<a href="/cart" id="plain">Cart</a>',
      });
      const [ext, tab, plain] = Array.from(
        fixture.nativeElement.querySelectorAll('a'),
      ) as Element[];
      expect(click(ext).defaultPrevented).toBe(false);
      expect(click(tab).defaultPrevented).toBe(false);
      expect(click(plain, { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('gives headings anchor ids and keeps #hash links on the page', async () => {
      const fixture = await render({
        content: '<p><a href="#details">Go</a></p><h3>Details</h3><h3>Details</h3>',
      });
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const headings = Array.from(el.querySelectorAll('h3'));
      expect(headings.map((h) => h.id)).toEqual(['details', 'details-2']);
      const scroll = jest.fn();
      headings[0].scrollIntoView = scroll;
      document.body.appendChild(el);
      const event = click(el.querySelector('a') as Element);
      document.body.removeChild(el);
      expect(event.defaultPrevented).toBe(true);
      expect(scroll).toHaveBeenCalled();
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });
});
