import { Injectable } from '@angular/core';
import { Constants } from '../common/constants';

@Injectable({
  providedIn: 'root'
})
export class PathUtilsService {

  private readonly CONTEXT_PATH_REGEXP = /\/(?:content|apps|libs|etc|etc.clientlibs|conf|mnt\/overlay)\//;
  private readonly JCR_CONTENT_PATTERN = `(.+)/jcr:content/(.+)`;
  private readonly DUMMY_ORIGIN = 'http://dummy';

  constructor() { }

  public isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  getContextPath(location?: string | null): string {
    const path = location || this.getCurrentPathname();
    if (!path) {
      return '';
    }

    const matches = path.match(this.CONTEXT_PATH_REGEXP);
    if (matches && matches.index !== undefined) {
      const index = matches.index;
      return path.slice(0, index + matches[0].length - 1);
    }
    return '';
  }

  public adaptPagePath(path: string, rootPath?: string): string {
    if (!path) {
      return '';
    }

    const localPath = this.internalize(path);

    if (!rootPath) {
      return localPath;
    }

    const localRootModelPath = this.sanitize(rootPath);

    return (localPath === localRootModelPath) ? '' : localPath;
  }

  public externalize(url: string): string {
    const contextPath = this.getContextPath();
    const externalizedPath = url.startsWith(contextPath) ? url : `${contextPath}${url}`;

    return externalizedPath;
  }

  public internalize(url: string | null): string {
    if (!url || (typeof url !== 'string')) {
      return '';
    }

    const contextPath = this.getContextPath();
    const internalizedPath = url.replace(new RegExp(`^${contextPath}/`), '/');

    return internalizedPath;
  }

  public getMetaPropertyValue(propertyName: string): string | null {
    let value = null;

    if (this.isBrowser()) {
      const meta = document.head.querySelector(`meta[property="${propertyName}"]`);
      value = meta ? meta.getAttribute('content') : null;
    }

    return value;
  }

  public convertToModelUrl(url: string): string | undefined {
    return url && url.replace && url.replace(/\.htm(l)?$/, '.model.json');
  }

  public getCurrentPageModelUrl(): string | null {
    const currentPath: string | null = this.getCurrentPathname();
    let url = null;

    if (currentPath) {
      url = this.convertToModelUrl(currentPath) || null;
    }

    return url;
  }

  public getModelUrl(url?: string): string | undefined {
    if (url) {
        return this.convertToModelUrl(url);
    }

    const metaModelUrl = this.getMetaPropertyValue('cq:pagemodel_root_url');

    if (metaModelUrl !== null) {
        return metaModelUrl;
    }

    return this.getCurrentPageModelUrl() ?? undefined;
  }

  public sanitize(path: string | null): string | null {
    if (!path || (typeof path !== 'string')) {
      return null;
    }

    let sanitizedPath = new URL(path, this.DUMMY_ORIGIN).pathname;

    if (sanitizedPath) {
      sanitizedPath = this.internalize(sanitizedPath);

      const selectorIndex = sanitizedPath.indexOf('.');

      if (selectorIndex > -1) {
        sanitizedPath = sanitizedPath.substr(0, selectorIndex);
      }

      sanitizedPath = sanitizedPath.replace(/\/+/g, '/');
    }

    return sanitizedPath;
  }

  public addExtension(path: string, extension: string): string {
    if (!extension || extension.length < 1) {
      return path;
    }
    if (!extension.startsWith('.')) {
      extension = `.${extension}`;
    }
    if (!path || (path.length < 1) || (path.indexOf(extension) > -1)) {
      return path;
    }

    let extensionPath = this.normalize(path);
    const url = new URL(extensionPath, this.DUMMY_ORIGIN);
    let resourcePath = this.sanitize(url.pathname);

    resourcePath = url.origin === this.DUMMY_ORIGIN ? resourcePath : url.origin + resourcePath;

    let pathWithoutResource = this._extractPathWithoutResource(url.pathname);

    pathWithoutResource = this._replaceExtension(pathWithoutResource, extension);
    extensionPath = (resourcePath + '.' + pathWithoutResource + url.search).replace(/\.\./g, '.');

    return extensionPath;
  }

  private _extractPathWithoutResource(path: string) {
    const slingElements = path.split('.');

    slingElements.shift();

    return slingElements.join('.');
  }

  private _replaceExtension(pathWithoutResource: string, extension: string) {
    if (pathWithoutResource.length < 1) {
      return extension;
    }

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

  public addSelector(path: string, selector: string): string {
    if (!selector || (selector.length < 1)) {
      return path;
    }

    if (!selector.startsWith('.')) {
      selector = `.${selector}`;
    }

    if (!path || (path.length < 1) || (path.indexOf(selector) > -1)) {
      return path;
    }

    const index = path.indexOf('.') || path.length;

    if (index < 0) {
      return path + selector;
    }

    return path.slice(0, index) + selector + path.slice(index, path.length);
  }

  public getCurrentPathname(): string | null {
    return this.isBrowser() ? window.location.pathname : null;
  }

  public getCurrentURL(): string {
    return this.isBrowser() ? window.location.href : '';
  }

  public dispatchGlobalCustomEvent(eventName: string, options: any): void {
    if (this.isBrowser()) {
      window.dispatchEvent(new CustomEvent(eventName, options));
    }
  }

  public join(paths?: string[]): string {
    return paths ? this.normalize(paths.filter((path) => path).join('/')) : '';
  }

  public normalize(path?: string): string {
    const normalizedPath = path ? path.replace(/\/+/g, '/') : '';

    return normalizedPath;
  }

  public makeAbsolute(path?: string): string {
    if (!path || (typeof path !== 'string')) {
      return '';
    }

    return path.startsWith('/') ? path : `/${path}`;
  }

  public makeRelative(path?: string): string {
    if (!path || (typeof path !== 'string')) {
      return '';
    }

    return path.startsWith('/') ? path.slice(1) : path;
  }

  public getParentNodePath(path: string | null): string | null {
    if (path && (path.length > 0)) {
      const splashIndex = path.lastIndexOf('/') + 1;

      if (splashIndex < path.length) {
        return path.substring(0, splashIndex - 1);
      }
    }

    return null;
  }



  public getNodeName(path: string): string | null {
    const chunks = (typeof path === 'string') ? path.replace(/\/+/g, '/').split(/\//).filter(Boolean) : [];
    const result = chunks.pop() || null;

    return result;
  }

  public subpath(targetPath?: string, rootPath?: string): string {
    if (!targetPath) {
      return '';
    }

    const targetPathChildren = this.makeRelative(targetPath).split('/');
    const rootPathChildren = this.makeRelative(rootPath).split('/');

    if (targetPathChildren.length < rootPathChildren.length) {
      return targetPath;
    }

    let index;

    for (index = 0; index < rootPathChildren.length; ++index) {
      if (targetPathChildren[index] !== rootPathChildren[index]) {
        break;
      }
    }

    if (index === rootPathChildren.length) {
      return targetPathChildren.slice(index).join('/');
    }

    return targetPath;
  }

  public splitByDelimitators(path: string, delimitators: string[]): string[] {
    let paths = [path];

    delimitators.forEach((delimitator) => {
      let newPaths: string[] = [];
      const delim = this.normalize(this.makeAbsolute(delimitator) + '/');

      paths.forEach((path) => {
        newPaths = newPaths.concat(path.split(delim));

        if (path.endsWith(delimitator)) {
          const lastPath = newPaths.splice(newPaths.length - 1, 1)[0];

          if (lastPath !== delimitator) {
            newPaths = newPaths.concat(lastPath.split(this.makeAbsolute(delimitator)));
          }
        }

        newPaths = newPaths.filter((path) => path);
      });

      paths = newPaths;
    });

    return paths;
  }

  public _getJCRPath(pagePath: string, dataPath: string): string {
    return [pagePath, 'jcr:content', dataPath].join('/');
  }

  public isItem(path: string): boolean {
    const JCR_CONTENT_PATTERN = new RegExp(`(.+)/${Constants.JCR_CONTENT}/(.+)`);
    return JCR_CONTENT_PATTERN.test(path);
  }

  public splitPageContentPaths(path: string): { itemPath?: string; pagePath: string } | undefined {
    console.log('splitPageContentPaths called with path:', path);
    if (!path && typeof path !== 'string') {
      return;
    }

    const splitPaths = path.split(`/jcr:content/`);
    const split: { pagePath: string; itemPath?: string } = { pagePath: splitPaths[0] };

    if (splitPaths.length > 1) {
      split.itemPath = splitPaths[1];
    }

    console.log('splitPageContentPaths result:', split);
    return split;
  }


  public trimStrings(path: string, strings: string[]): string {
    strings.forEach((str) => {
      while (path.startsWith(str)) {
        path = this.makeRelative(path.slice(str.length));
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

  public _getStartStrings(path: string, strings: string[]): string {
    let returnStr = '';

    strings.forEach((str) => {
      while (path.startsWith(str)) {
        path = this.makeRelative(path.slice(str.length));
        returnStr = `${returnStr}/${str}`;
      }
    });

    return this.makeRelative(returnStr);
  }

  public toAEMPath(path: string, aemHost: string, rootPath: string): string {
    const isLoadedInAEM = this.isBrowser() && window.location.origin === aemHost;

    if (isLoadedInAEM) {
      rootPath = rootPath.replace(/^\/|\/$/g, '');

      const aemPathPrefix = `(/editor.html)?(/content/${rootPath})?`;

      if (path.indexOf(aemPathPrefix) < 0) {
        const newPath = (`${aemPathPrefix}${path}(.html)?`);

        return newPath;
      }
    }

    return path;
  }
}
