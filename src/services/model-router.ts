import { EventType, MetaProperty } from '../common/constants';
import { PathUtilsInterface } from '../common/path-utils.interface';
import { ModelManagerInterface } from '../common/model-manager.interface';

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

/**
 * Returns the model path. If no URL is provided the current window URL is used.
 * @param [url] url from which to extract the model path
 * @param pathUtils PathUtils instance
 * @private
 * @return
 */
export function getModelPath(url: string | null | URL | undefined, pathUtils: PathUtilsInterface): string | null {
    const localUrl = (url || (pathUtils.isBrowser() && window.location.pathname)) as string;
    return localUrl ? pathUtils.sanitize(localUrl) : null;
}

/**
 * Returns the list of provided route filters
 * @param pathUtils PathUtils instance
 * @returns {string[]}
 * @private
 */
export function getRouteFilters(pathUtils: PathUtilsInterface): string[] {
    const routeFilters = pathUtils.getMetaPropertyValue(MetaProperty.PAGE_MODEL_ROUTE_FILTERS);
    return routeFilters ? routeFilters.split(',') : [];
}

/**
 * Should the route be excluded
 * @param route
 * @param pathUtils PathUtils instance
 * @returns {boolean}
 * @private
 */
export function isRouteExcluded(route: string, pathUtils: PathUtilsInterface): boolean {
    return getRouteFilters(pathUtils).some(filter => new RegExp(filter).test(route));
}

/**
 * Is the model router enabled. Enabled by default
 * @param pathUtils PathUtils instance
 * @returns {boolean}
 * @private
 */
export function isModelRouterEnabled(pathUtils: PathUtilsInterface): boolean {
    if (!pathUtils.isBrowser()) return false;

    const modelRouterMetaType = pathUtils.getMetaPropertyValue(MetaProperty.PAGE_MODEL_ROUTER);
    return !modelRouterMetaType || modelRouterMetaType !== RouterModes.DISABLED;
}

/**
 * Fetches the model from the PageModelManager and then dispatches it
 * @fires cq-pagemodel-route-changed
 * @param {string} [path] - path of the model to be dispatched
 * @param modelManager ModelManager instance
 * @param pathUtils PathUtils instance
 * @private
 */
export function dispatchRouteChanged(path: string, modelManager: ModelManagerInterface, pathUtils: PathUtilsInterface): void {
    modelManager.getData({ path }).then(model => {
        pathUtils.dispatchGlobalCustomEvent(EventType.PAGE_MODEL_ROUTE_CHANGED, {
            detail: { model }
        });
    });
}

/**
 * Triggers the PageModelManager to fetch data based on the current route
 * @fires cq-pagemodel-route-changed - with the root page model object
 * @param {string} [url] - url from which to extract the model path
 * @param modelManager ModelManager instance
 * @param pathUtils PathUtils instance
 * @private
 */
export function routeModel(url: string | null | URL | undefined, modelManager: ModelManagerInterface, pathUtils: PathUtilsInterface): void {
    if (!isModelRouterEnabled(pathUtils)) return;

    const path = getModelPath(url, pathUtils);

    if (path && path !== '/' && !isRouteExcluded(path, pathUtils)) {
        dispatchRouteChanged(path, modelManager, pathUtils);
    }
}

export function initModelRouter(modelManager: ModelManagerInterface, pathUtils: PathUtilsInterface): void {
    if (isModelRouterEnabled(pathUtils) && pathUtils.isBrowser()) {
        const { pushState, replaceState } = window.history;

        window.addEventListener('popstate', event => {
            const target = event.target as Window;
            routeModel(target?.location?.pathname || null, modelManager, pathUtils);
        });

        window.history.pushState = function (state, title, url) {
            routeModel(url, modelManager, pathUtils);
            return pushState.apply(history, [state, title, url]);
        };

        window.history.replaceState = function (state, title, url) {
            routeModel(url || null, modelManager, pathUtils);
            return replaceState.apply(history, [state, title, url]);
        };
    }
}
