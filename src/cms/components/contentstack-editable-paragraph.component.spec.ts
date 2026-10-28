import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  async function render(
    data: ContentstackEditableParagraphData,
  ): Promise<ComponentFixture<ContentstackEditableParagraphComponent>> {
    await TestBed.configureTestingModule({
      imports: [ContentstackEditableParagraphComponent],
      providers: [{ provide: CmsComponentData, useValue: { uid: 'blt1', data$: of(data) } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ContentstackEditableParagraphComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

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
});
