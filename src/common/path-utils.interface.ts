export interface PathUtilsInterface {
    isBrowser(): boolean;
    sanitize(path: string | null): string | null;
    getMetaPropertyValue(propertyName: string): string | null;
    internalize(url: string | null): string;
    getCurrentPathname(): string | null;
    isItem(path: string): boolean;
    addSelector(path: string, selector: string): string;
    addExtension(path: string, extension: string): string;
    makeAbsolute(path: string): string;
    externalize(path: string): string;
    adaptPagePath(path: string, rootPath?: string): string;
    splitPageContentPaths(path: string): { itemPath?: string; pagePath: string } | undefined;
    dispatchGlobalCustomEvent(eventName: string, options: any): void;
    getCurrentURL(): string;
}
