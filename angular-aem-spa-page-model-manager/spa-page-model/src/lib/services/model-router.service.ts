import { Injectable } from '@angular/core';
import { EventType, MetaProperty } from '../common/constants';
import { PathUtilsService } from '../utils/path.service';
import { ModelManagerService } from './model-manager.service';

/**
 * Modes in which the Model Router operates.
 * @private
 */
export class RouterModes {
  /**
   * Flag that indicates that the model router should be disabled.
   */
  public static readonly DISABLED = 'disabled';

  /**
   * Flag that indicates that the model router should extract the model path from the content path section of the URL.
   */
  public static readonly CONTENT_PATH = 'path';
}

@Injectable({
  providedIn: 'root'
})
export class ModelRouterService {
  constructor(
    private pathUtils: PathUtilsService,
    private modelManager: ModelManagerService
  ) { }

  /**
   * Returns the model path. If no URL is provided the current window URL is used.
   * @param [url] url from which to extract the model path
   * @return
   */
  public getModelPath(url: string | null | URL | undefined): string | null {
    const localUrl = (url || (this.pathUtils.isBrowser() && window.location.pathname)) as string;
    return localUrl ? this.pathUtils.sanitize(localUrl) : null;
  }

  /**
   * Returns the list of provided route filters
   * @returns {string[]}
   */
  public getRouteFilters(): string[] {
    const routeFilters = this.pathUtils.getMetaPropertyValue(MetaProperty.PAGE_MODEL_ROUTE_FILTERS);
    return routeFilters ? routeFilters.split(',') : [];
  }

  /**
   * Should the route be excluded
   * @param route
   * @returns {boolean}
   */
  public isRouteExcluded(route: string): boolean {
    return this.getRouteFilters().some(filter => new RegExp(filter).test(route));
  }

  /**
   * Is the model router enabled. Enabled by default
   * @returns {boolean}
   */
  public isModelRouterEnabled(): boolean {
    if (!this.pathUtils.isBrowser()) return false;

    const modelRouterMetaType = this.pathUtils.getMetaPropertyValue(MetaProperty.PAGE_MODEL_ROUTER);
    return !modelRouterMetaType || modelRouterMetaType !== RouterModes.DISABLED;
  }

  /**
   * Fetches the model from the PageModelManager and then dispatches it
   * @fires cq-pagemodel-route-changed
   * @param {string} [path] - path of the model to be dispatched
   */
  public dispatchRouteChanged(path: string): void {
    this.modelManager.getData({ path }).then(model => {
      this.pathUtils.dispatchGlobalCustomEvent(EventType.PAGE_MODEL_ROUTE_CHANGED, {
        detail: { model }
      });
    });
  }

  /**
   * Triggers the PageModelManager to fetch data based on the current route
   * @fires cq-pagemodel-route-changed - with the root page model object
   * @param {string} [url] - url from which to extract the model path
   */
  public routeModel(url: string | null | URL | undefined): void {
    if (!this.isModelRouterEnabled()) return;

    const path = this.getModelPath(url);

    if (path && path !== '/' && !this.isRouteExcluded(path)) {
      this.dispatchRouteChanged(path);
    }
  }

  public initModelRouter(): void {
    if (this.isModelRouterEnabled() && this.pathUtils.isBrowser()) {
      const { pushState, replaceState } = window.history;

      window.addEventListener('popstate', event => {
        const target = event.target as Window;
        this.routeModel(target?.location?.pathname || null);
      });

      window.history.pushState = (state, title, url) => {
        this.routeModel(url);
        return pushState.apply(history, [state, title, url]);
      };

      window.history.replaceState = (state, title, url) => {
        this.routeModel(url || null);
        return replaceState.apply(history, [state, title, url]);
      };
    }
  }
}
