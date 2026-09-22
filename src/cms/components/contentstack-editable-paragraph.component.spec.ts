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
});
