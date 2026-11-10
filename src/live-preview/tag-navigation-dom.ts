import type { CmsNavigationNodeWithTags } from '../cms/converters/components/contentstack-cms-navigation-component.normalizer';

/**
 * Tag the labels of a rendered Spartacus navigation (`cx-navigation-ui`) with
 * the Visual Builder edit tags carried on the normalized node tree (DX-27704).
 *
 * The stock navigation template has no hook for per-item attributes, but its
 * structure is fixed: every node is one `<li>` in a `<ul>`, in child order, with
 * its label (`cx-generic-link > a`, `h4` or `span`) as a direct child and its
 * children in `div.wrapper > ul.childs`. We walk that structure alongside the
 * tree, matching by position, and only tag a label whose text equals the
 * node's title or link name, so a template change or an unexpected node can't
 * put a tag on the wrong item. Returns the number of labels tagged.
 */
export function tagNavigationDom(
  root: Element,
  tree: CmsNavigationNodeWithTags | undefined,
  locale?: (tag: string) => string,
): number {
  const list = root.querySelector('nav > ul');
  if (!list || !tree?.children?.length) {
    return 0;
  }
  return tagLevel(list, tree.children as CmsNavigationNodeWithTags[], locale ?? ((t) => t));
}

function tagLevel(
  list: Element,
  nodes: CmsNavigationNodeWithTags[],
  locale: (tag: string) => string,
): number {
  // `li.back` is the flyout's "Back" button, not a node.
  const items = Array.from(list.children).filter(
    (el) => el.tagName === 'LI' && !el.classList.contains('back'),
  );
  let tagged = 0;
  items.forEach((li, i) => {
    const node = nodes[i];
    if (!node) {
      return;
    }
    const label = labelOf(li);
    const text = label?.textContent?.trim();
    const tags = node.csTags;
    const tag =
      text && tags?.title?.text?.trim() === text
        ? tags.title.cslp
        : text && tags?.link?.text?.trim() === text
          ? tags.link.cslp
          : undefined;
    if (label && tag) {
      label.setAttribute('data-cslp', locale(tag));
      tagged++;
    }
    const childList = li.querySelector(':scope > div.wrapper > ul');
    if (childList && node.children?.length) {
      tagged += tagLevel(childList, node.children as CmsNavigationNodeWithTags[], locale);
    }
  });
  return tagged;
}

/** The element showing a node's label: the link itself, or the heading text. */
function labelOf(li: Element): Element | null {
  return (
    li.querySelector(':scope > cx-generic-link > a') ??
    li.querySelector(':scope > h4, :scope > span, :scope > a')
  );
}
