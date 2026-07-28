/*
 * Minimal type shims for the `@spartacus/*` packages, used only for offline
 * typechecking in this workspace (the built packages are not installed here).
 *
 * Every symbol/signature below is transcribed from the Spartacus source in
 * ../spartacus (v221121.x / Angular 21). They exist so `tsc` can verify THIS
 * library's code against the real contract shapes without an npm install. When
 * the real `@spartacus/*` packages are installed in the consuming app, these
 * shims are not used (the tsconfig only maps them for the local typecheck).
 */

declare module '@spartacus/core' {
  import { Observable } from 'rxjs';
  import { Provider } from '@angular/core';

  // --- routing ---
  export enum PageType {
    CONTENT_PAGE = 'ContentPage',
    PRODUCT_PAGE = 'ProductPage',
    CATEGORY_PAGE = 'CategoryPage',
    CATALOG_PAGE = 'CatalogPage',
  }
  export class PageContext {
    id: string;
    type?: PageType;
    constructor(id: string, type?: PageType);
  }
  export const HOME_PAGE_CONTEXT: string;
  export const SMART_EDIT_CONTEXT: string;
  export enum PageRobotsMeta {
    INDEX = 'INDEX',
    NOINDEX = 'NOINDEX',
    FOLLOW = 'FOLLOW',
    NOFOLLOW = 'NOFOLLOW',
  }

  // --- cms models ---
  export interface ContentSlotComponentData {
    uid?: string;
    typeCode?: string;
    flexType?: string;
    properties?: any;
  }
  export interface ContentSlotData {
    components?: ContentSlotComponentData[];
    properties?: any;
  }
  export interface Page {
    pageId?: string;
    name?: string;
    description?: string;
    type?: PageType | string;
    title?: string;
    template?: string;
    loadTime?: number;
    slots?: { [key: string]: ContentSlotData };
    properties?: any;
    label?: string;
    robots?: PageRobotsMeta[];
  }
  export interface CmsComponent {
    modifiedTime?: Date;
    name?: string;
    otherProperties?: any;
    typeCode?: string;
    uid?: string;
    container?: string;
    styleClasses?: string;
    [field: string]: any;
  }
  export interface CmsStructureModel {
    page?: Page;
    components?: CmsComponent[];
  }
  export interface CmsNavigationEntry {
    itemId?: string;
    itemSuperType?: string;
    itemType?: string;
  }
  export interface CmsNavigationNode {
    uid?: string;
    title?: string;
    children?: Array<CmsNavigationNode>;
    entries?: Array<CmsNavigationEntry>;
  }

  // --- component-specific CMS models (banner/navigation/product-carousel normalizers) ---
  export interface CmsBannerComponentMedia {
    altText?: string;
    code?: string;
    mime?: string;
    url?: string;
  }
  export interface CmsBannerComponent extends CmsComponent {
    media?: {
      desktop?: CmsBannerComponentMedia;
      mobile?: CmsBannerComponentMedia;
      tablet?: CmsBannerComponentMedia;
      widescreen?: CmsBannerComponentMedia;
    };
  }
  export interface CmsNavigationEntry {
    itemId: string;
    itemSuperType: string;
    itemType: string;
  }
  export interface CmsNavigationNode {
    uid: string;
    title?: string;
    children?: CmsNavigationNode[];
    entries?: CmsNavigationEntry[];
  }
  export interface CmsNavigationComponent extends CmsComponent {
    navigationNode?: CmsNavigationNode;
  }
  export interface CmsProductCarouselComponent extends CmsComponent {
    productCodes?: string;
  }

  // --- cms connectors ---
  export abstract class CmsPageAdapter {
    abstract load(pageContext: PageContext): Observable<CmsStructureModel>;
  }
  export abstract class CmsComponentAdapter {
    abstract load<T extends CmsComponent>(
      id: string,
      pageContext: PageContext,
      fields?: string
    ): Observable<T>;
    abstract findComponentsByIds(
      ids: string[],
      pageContext: PageContext
    ): Observable<CmsComponent[]>;
  }
  // OCC implementations — injectable (providedIn: 'root'); used by the connector
  // as the hybrid base/fallback while it overrides the abstract tokens above.
  export class OccCmsPageAdapter {
    load(pageContext: PageContext): Observable<CmsStructureModel>;
  }
  export class OccCmsComponentAdapter {
    load<T extends CmsComponent>(
      id: string,
      pageContext: PageContext,
      fields?: string
    ): Observable<T>;
    findComponentsByIds(
      ids: string[],
      pageContext: PageContext,
      fields?: string,
      currentPage?: number,
      pageSize?: number,
      sort?: string
    ): Observable<CmsComponent[]>;
  }

  // --- converters ---
  export interface Converter<SOURCE, TARGET> {
    convert(source: SOURCE, target?: TARGET): TARGET;
  }

  // --- config ---
  export abstract class Config {}
  export interface CmsComponentMapping {
    component?: any;
    providers?: Provider[];
    guards?: any[];
    data?: any;
    [key: string]: any;
  }
  export interface CmsConfig extends Config {
    cmsComponents?: { [componentType: string]: CmsComponentMapping };
    featureModules?: {
      [featureName: string]: {
        module: () => Promise<any>;
        cmsComponents?: string[];
      };
    };
    [key: string]: any;
  }
  export function provideConfig(config?: any, inRoot?: boolean): Provider;
  export function provideDefaultConfig(config?: any): Provider;

  // --- product ---
  export enum ProductScope {
    LIST = 'list',
    DETAILS = 'details',
    ATTRIBUTES = 'attributes',
    PRICE = 'price',
    STOCK = 'stock',
    VARIANTS = 'variants',
  }
  export interface Price {
    formattedValue?: string;
    value?: number;
    currencyIso?: string;
  }
  export interface Stock {
    stockLevel?: number;
    stockLevelStatus?: string;
  }
  export interface Product {
    code?: string;
    name?: string;
    summary?: string;
    price?: Price;
    stock?: Stock;
    [field: string]: any;
  }
  export abstract class ProductService {
    abstract get(
      productCode: string,
      scopes?: (ProductScope | string)[] | ProductScope | string
    ): Observable<Product | undefined>;
  }

  // --- decorators (Live Preview / Visual Editor) ---
  export abstract class ComponentDecorator {
    abstract decorate(
      element: Element,
      renderer: unknown,
      component: ContentSlotComponentData
    ): void;
  }

  // --- logging ---
  export class LoggerService {
    log(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
  }

  // --- i18n / routing ---
  export abstract class LanguageService {
    abstract getActive(): Observable<string>;
  }
  export abstract class RoutingService {
    abstract getPageContext(): Observable<PageContext>;
  }

  // --- NgRx store integration (live component updates) ---
  export interface StateWithCms {
    [key: string]: unknown;
  }
  export namespace CmsActions {
    export class LoadCmsComponentSuccess {
      type: string;
      constructor(payload: {
        component: CmsComponent;
        uid: string;
        pageContext: PageContext;
      });
    }
    export class LoadCmsPageDataSuccess {
      type: string;
      constructor(pageContext: PageContext, payload: Page);
    }
  }
}

declare module '@spartacus/storefront' {
  import { Observable } from 'rxjs';
  import { CmsComponent } from '@spartacus/core';

  export class CmsComponentData<T extends CmsComponent | object = any> {
    uid: string;
    data$: Observable<T>;
  }
}

declare module '@spartacus/cart/base/root' {
  export abstract class ActiveCartFacade {
    abstract addEntry(
      productCode: string,
      quantity: number,
      pickupStore?: string
    ): void;
  }
}
