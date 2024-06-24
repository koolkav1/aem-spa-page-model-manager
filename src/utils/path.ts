import {Constants, MetaProperty} from '../common/constants';
import {InternalConstants} from '../common/internal-contants';


const CONTEXT_PATH_REGEXP = /(?:\/)(?:content|apps|libs|etc|etc.clientlibs|conf|mnt\/overlay)(?:\/)/;
const JCR_CONTENT_PATTERN = `(.+)/${Constants.JCR_CONTENT}/(.+)`;
const DUMMY_ORIGIN = 'http://dummy';

export class PathUtils {
    public static isBrowser(): boolean {
        return typeof window !== 'undefined';
    }

    public static getContextPath(location?: string | null): string {
        const path = location || this.getCurrentPathname();
        if (!path) return '';

        const matches = path.match(CONTEXT_PATH_REGEXP);
        const index = matches ? matches.index ?? -1 : -1;
        return index > 0 ? path.slice(0, index) : '';
    }

    public static adaptPagePath(path: string, rootPath?: string): string {
        if (!path) return '';
        const localPath = PathUtils.internalize(path);
        if (!rootPath) return localPath;

        const localRootModelPath = PathUtils.sanitize(rootPath);
        return localPath === localRootModelPath ? '' : localPath;
    }

    public static externalize(url: string): string {
        const contextPath = this.getContextPath();
        return url.startsWith(contextPath) ? url : `${contextPath}${url}`;
    }

    public static internalize(url: string | null): string {
        if (!url || typeof url !== 'string') return '';
        const contextPath = this.getContextPath();
        return url.replace(new RegExp(`^${contextPath}/`), '/');
    }

    public static getMetaPropertyValue(propertyName: string): string | null {
        if (!this.isBrowser()) return null;
        const meta = document.head.querySelector(`meta[property="${propertyName}"]`);
        return meta ? meta.getAttribute('content') : null;
    }

    public static convertToModelUrl(url: string): string | undefined {
        return url.replace(/\.htm(l)?$/, InternalConstants.DEFAULT_MODEL_JSON_EXTENSION);
    }

    public static getCurrentPageModelUrl(): string | null {
        const currentPath = this.getCurrentPathname();
        return currentPath ? this.convertToModelUrl(currentPath) || null : null;
    }

    public static getModelUrl(url?: string): string | undefined {
        if (url) {
            return this.convertToModelUrl(url);
        }
        const metaModelUrl = this.getMetaPropertyValue(MetaProperty.PAGE_MODEL_ROOT_URL);
        if (metaModelUrl !== null) {
            return metaModelUrl;
        }
        return this.getCurrentPageModelUrl() || undefined;
    }

    public static sanitize(path: string | null): string | null {
        if (!path || typeof path !== 'string') return null;

        let sanitizedPath = this.parsePathname(path);
        if (sanitizedPath) {
            sanitizedPath = this.internalize(sanitizedPath);
            const selectorIndex = sanitizedPath.indexOf('.');
            if (selectorIndex > -1) {
                sanitizedPath = sanitizedPath.substr(0, selectorIndex);
            }
            sanitizedPath = this.normalize(sanitizedPath);
        }

        return sanitizedPath;
    }

    private static parsePathname(path: string): string | null {
        try {
            const url = new URL(path, DUMMY_ORIGIN);
            return url.pathname;
        } catch {
            return path;
        }
    }

    public static addExtension(path: string, extension: string): string {
        if (!extension) return path;
        extension = extension.startsWith('.') ? extension : `.${extension}`;
        if (!path || path.includes(extension)) return path;

        let extensionPath = this.normalize(path);
        const parsedUrl = new URL(extensionPath, DUMMY_ORIGIN);
        let resourcePath = this.sanitize(parsedUrl.pathname);

        resourcePath = parsedUrl.origin === DUMMY_ORIGIN ? resourcePath : parsedUrl.origin + resourcePath;
        let pathWithoutResource = this._extractPathWithoutResource(parsedUrl.pathname);

        pathWithoutResource = this._replaceExtension(pathWithoutResource, extension);
        extensionPath = (resourcePath + '.' + pathWithoutResource + parsedUrl.search).replace(/\.\./g, '.');

        return extensionPath;
    }

    private static _extractPathWithoutResource(path: string): string {
        const slingElements = path.split('.');
        slingElements.shift();
        return slingElements.join('.');
    }

    private static _replaceExtension(pathWithoutResource: string, extension: string): string {
        if (pathWithoutResource.length < 1) return extension;

        const slingElementsWithoutResource = pathWithoutResource.split('/');
        const selectors = slingElementsWithoutResource[0].split('.');
        let currentExtension = selectors.pop();

        currentExtension = currentExtension ? currentExtension.replace(/htm(l)?/, '') : '';
        let path = selectors.join('.') + '.' + currentExtension + extension;

        slingElementsWithoutResource.shift();
        if (slingElementsWithoutResource.length > 0) {
            path += slingElementsWithoutResource.join('/');
        }

        return path;
    }

    public static addSelector(path: string, selector: string): string {
        if (!selector) return path;
        selector = selector.startsWith('.') ? selector : `.${selector}`;
        if (!path || path.includes(selector)) return path;

        const index = path.indexOf('.') || path.length;
        return path.slice(0, index) + selector + path.slice(index);
    }

    public static getCurrentPathname(): string | null {
        return this.isBrowser() ? window.location.pathname : null;
    }

    public static getCurrentURL(): string {
        return this.isBrowser() ? window.location.href : '';
    }

    public static dispatchGlobalCustomEvent(eventName: string, options: any): void {
        if (this.isBrowser()) {
            window.dispatchEvent(new CustomEvent(eventName, options));
        }
    }

    public static join(paths?: string[]): string {
        return paths ? this.normalize(paths.filter(Boolean).join('/')) : '';
    }

    public static normalize(path?: string): string {
        return path ? path.replace(/\/+/g, '/') : '';
    }

    public static makeAbsolute(path?: string): string {
        if (!path || typeof path !== 'string') return '';
        return path.startsWith('/') ? path : `/${path}`;
    }

    public static makeRelative(path?: string): string {
        if (!path || typeof path !== 'string') return '';
        return path.startsWith('/') ? path.slice(1) : path;
    }

    public static getParentNodePath(path: string | null): string | null {
        if (path) {
            const splashIndex = path.lastIndexOf('/') + 1;
            if (splashIndex < path.length) {
                return path.substring(0, splashIndex - 1);
            }
        }
        return null;
    }

    public static isItem(path: string): boolean {
        return new RegExp(JCR_CONTENT_PATTERN).test(path);
    }

    public static getNodeName(path: string): string | null {
        const chunks = path ? path.replace(/\/+/g, '/').split('/').filter(Boolean) : [];
        return chunks.pop() || null;
    }

    public static subpath(targetPath?: string, rootPath?: string): string {
        if (!targetPath) return '';

        const targetPathChildren = PathUtils.makeRelative(targetPath).split('/');
        const rootPathChildren = PathUtils.makeRelative(rootPath).split('/');

        if (targetPathChildren.length < rootPathChildren.length) {
            return targetPath;
        }

        let index;
        for (index = 0; index < rootPathChildren.length; ++index) {
            if (targetPathChildren[index] !== rootPathChildren[index]) {
                break;
            }
        }

        return index === rootPathChildren.length
            ? targetPathChildren.slice(index).join('/')
            : targetPath;
    }

    public static splitByDelimitators(path: string, delimitators: string[]): string[] {
        let paths = [path];

        delimitators.forEach(delimitator => {
            let newPaths: string[] = [];
            const delim = PathUtils.normalize(PathUtils.makeAbsolute(delimitator) + '/');

            paths.forEach(pathSegment => {
                newPaths = newPaths.concat(pathSegment.split(delim));
                if (pathSegment.endsWith(delimitator)) {
                    const lastPath = newPaths.splice(newPaths.length - 1, 1)[0];
                    if (lastPath !== delimitator) {
                        newPaths = newPaths.concat(lastPath.split(PathUtils.makeAbsolute(delimitator)));
                    }
                }
                newPaths = newPaths.filter(Boolean);
            });

            paths = newPaths;
        });

        return paths;
    }

    public static _getJCRPath(pagePath: string, dataPath: string): string {
        return [pagePath, Constants.JCR_CONTENT, dataPath].join('/');
    }

    public static splitPageContentPaths(path: string): { itemPath?: string; pagePath: string } | undefined {
        if (!path || typeof path !== 'string') return;

        const splitPaths = path.split(`/${Constants.JCR_CONTENT}/`);
        return {
            pagePath: splitPaths[0],
            itemPath: splitPaths[1],
        };
    }

    public static trimStrings(path: string, strings: string[]): string {
        strings.forEach(str => {
            while (path.startsWith(str)) {
                path = PathUtils.makeRelative(path.slice(str.length));
            }

            while (path.endsWith(str)) {
                path = path.slice(0, path.length - str.length);
                if (path.endsWith('/')) {
                    path = path.slice(0, path.length - 1);
                }
            }
        });

        return path;
    }

    public static _getStartStrings(path: string, strings: string[]): string {
        let returnStr = '';

        strings.forEach(str => {
            while (path.startsWith(str)) {
                path = PathUtils.makeRelative(path.slice(str.length));
                returnStr = `${returnStr}/${str}`;
            }
        });

        return PathUtils.makeRelative(returnStr);
    }

    public static toAEMPath(path: string, aemHost: string, rootPath: string): string {
        const isLoadedInAEM = this.isBrowser() && window.location.origin === aemHost;
        if (isLoadedInAEM) {
            rootPath = rootPath.replace(/^\/|\/$/g, '');
            const aemPathPrefix = `(/editor.html)?(/content/${rootPath})?`;

            if (!path.includes(aemPathPrefix)) {
                return `${aemPathPrefix}${path}(.html)?`;
            }
        }

        return path;
    }
}
