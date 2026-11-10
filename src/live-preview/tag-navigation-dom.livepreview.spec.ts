import { tagNavigationDom } from './tag-navigation-dom';
import type { CmsNavigationNodeWithTags } from '../cms/converters/components/contentstack-cms-navigation-component.normalizer';

/**
 * Minimal stand-in for the DOM the stock `cx-navigation-ui` renders (Jest runs
 * in node here). Supports exactly the structure and selectors the tagger uses.
 */
class El {
  attrs: Record<string, string> = {};
  constructor(
    public tagName: string,
    public children: El[] = [],
    public text = '',
    public classes: string[] = [],
  ) {}
  get classList() {
    return { contains: (c: string) => this.classes.includes(c) };
  }
  get textContent() {
    return this.text;
  }
  setAttribute(n: string, v: string) {
    this.attrs[n] = v;
  }
  hasAttribute(n: string) {
    return n in this.attrs;
  }
  private child(tag: string) {
    return this.children.find((c) => c.tagName === tag) ?? null;
  }
  querySelector(sel: string): El | null {
    switch (sel) {
      case 'nav > ul':
        return this.child('NAV')?.child('UL') ?? null;
      case ':scope > cx-generic-link > a':
        return this.child('CX-GENERIC-LINK')?.child('A') ?? null;
      case ':scope > h4, :scope > span, :scope > a':
        return this.child('H4') ?? this.child('SPAN') ?? this.child('A');
      case ':scope > div.wrapper > ul':
        return this.child('DIV')?.child('UL') ?? null;
      default:
        throw new Error(`unsupported selector ${sel}`);
    }
  }
}

const link = (text: string) => new El('CX-GENERIC-LINK', [new El('A', [], ` ${text} `)]);
const heading = (text: string) => new El('H4', [], ` ${text} `);
const li = (label: El, children: El[] = [], classes: string[] = []) =>
  new El(
    'LI',
    children.length ? [label, new El('DIV', [new El('UL', children)])] : [label],
    '',
    classes,
  );
const nav = (...items: El[]) =>
  new El('CX-CATEGORY-NAVIGATION', [new El('NAV', [new El('UL', items)])]);

const node = (title: string, cslp: string, children: CmsNavigationNodeWithTags[] = []) =>
  ({ title, children, csTags: { title: { text: title, cslp } } }) as CmsNavigationNodeWithTags;

describe('tagNavigationDom', () => {
  const tree = {
    children: [
      node('Brands', 'nav_node_flat.b.en-us.title', [node('Canon', 'nav_node_flat.c.en-us.title')]),
      node('Cameras', 'nav_node_flat.k.en-us.title'),
    ],
  } as CmsNavigationNodeWithTags;

  it('tags each label with its node title tag, at every depth', () => {
    const canon = link('Canon');
    const root = nav(
      li(new El('BUTTON', [], 'Back'), [], ['back']),
      li(link('Brands'), [li(canon)]),
      li(heading('Cameras')),
    );
    expect(tagNavigationDom(root as unknown as Element, tree)).toBe(3);
    expect(canon.children[0].attrs['data-cslp']).toBe('nav_node_flat.c.en-us.title');
  });

  it('retargets tags to the active locale', () => {
    const brands = link('Brands');
    tagNavigationDom(nav(li(brands)) as unknown as Element, tree, (t) =>
      t.replace('en-us', 'de-de'),
    );
    expect(brands.children[0].attrs['data-cslp']).toBe('nav_node_flat.b.de-de.title');
  });

  it('falls back to the link name tag when the label shows the link name', () => {
    const t = {
      children: [
        {
          title: '',
          csTags: { link: { text: 'Contact Us', cslp: 'cms_link_component.l.en-us.link_name' } },
        },
      ],
    } as CmsNavigationNodeWithTags;
    const label = link('Contact Us');
    tagNavigationDom(nav(li(label)) as unknown as Element, t);
    expect(label.children[0].attrs['data-cslp']).toBe('cms_link_component.l.en-us.link_name');
  });

  it('does not tag a label whose text does not match its node', () => {
    const label = link('Something else');
    expect(tagNavigationDom(nav(li(label)) as unknown as Element, tree)).toBe(0);
    expect(label.children[0].hasAttribute('data-cslp')).toBe(false);
  });
});
