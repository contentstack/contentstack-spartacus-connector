import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { LoggerService } from '@spartacus/core';

/**
 * SmartEdit / SAP CMS preview bypass.
 *
 * ## Primary mechanism: omission
 * The most important "guard" is architectural — this library's feature module
 * does **not** import `SmartEditRootModule`. That module is what registers the
 * `CmsTicketInterceptor` (appends `cmsTicketId` to OCC calls) and, critically,
 * an `APP_INITIALIZER` (`smartEditFactory` → `SmartEditLauncherService.load()`)
 * that boots a handshake with the SAP SmartEdit iframe. By never importing it,
 * the storefront has nothing that blocks startup waiting on the (now removed)
 * SAP CMS layout engine.
 *
 * ## Secondary mechanism: this guard
 * If a legacy bookmark or an external system sends a shopper to a URL carrying
 * SmartEdit preview params (e.g. `?cmsTicketId=...`), those params are
 * meaningless now — SAP no longer serves CMS. {@link smartEditBypassGuard}
 * strips them and re-navigates to the clean URL, so the page renders normally
 * from Contentstack instead of a downstream consumer attempting a handshake.
 *
 * The page adapter already returns an empty structure for the Spartacus
 * `SMART_EDIT_CONTEXT`, so these two layers together guarantee the storefront
 * never stalls on SmartEdit.
 *
 * SAP CMS preview is replaced by Contentstack Live Preview in a later phase.
 */

/** Query params SmartEdit appends that we strip when bypassing. */
const SMART_EDIT_QUERY_PARAMS = ['cmsTicketId', 'cmsTicket', 'liveEditMode'];

/**
 * Functional route guard that neutralizes inbound SmartEdit preview params.
 *
 * Attach to any route that might receive them (typically the catch-all content
 * route). Returns `true` for normal navigation, or a cleaned `UrlTree` when
 * SmartEdit params are detected.
 */
export const smartEditBypassGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean | UrlTree => {
  const router = inject(Router);
  const logger = inject(LoggerService);
  const params = route.queryParams ?? {};

  const hasSmartEditParams = SMART_EDIT_QUERY_PARAMS.some(
    (key) => params[key] != null
  );
  if (!hasSmartEditParams) {
    return true;
  }

  const cleanedParams: Record<string, unknown> = { ...params };
  for (const key of SMART_EDIT_QUERY_PARAMS) {
    delete cleanedParams[key];
  }

  // Path without the query string; re-navigate with the SmartEdit params removed.
  const path = state.url.split('?')[0];
  logger.warn(
    '[contentstack] Stripped SAP SmartEdit preview params from route; ' +
      'rendering from Contentstack instead.'
  );
  return router.createUrlTree([path], { queryParams: cleanedParams });
};
