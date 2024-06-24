import { Injectable } from '@angular/core';
import { Constants, ItemWrapper } from '../common/constants';
import { Model } from '../common/model.interface';
import { PathUtilsService } from '../utils/path.service';

@Injectable({
    providedIn: 'root'
})
export class ModelStoreService {
    private _pageContentDelimiter: string[] | null;
    private _data: Model | null = null;
    private _rootPath: string | null = null;

    constructor(private pathUtils: PathUtilsService) {
        this._data = {};
        this._pageContentDelimiter = [Constants.JCR_CONTENT];
    }

    public initialize(rootPath: string, data: Model): void {
        this._data = data;
        this._rootPath = rootPath;
    }

    public get rootPath(): string {
        return this._rootPath || "";
    }

    public get dataMap(): Model | null {
        return this._data;
    }

    public setData(path: string, newData: any = {}): void {
        const itemKey = this.pathUtils.getNodeName(path);
        console.log('itemKey:', itemKey);
        if (!itemKey) return;

        const parentPath = this.pathUtils.getParentNodePath(path);
        console.log('parentPath:', parentPath);
        const parentData = this.getData(parentPath, false);
        console.log('parent data before setting:', parentData);
        if (parentData && parentData[Constants.ITEMS_PROP]) {
            const localData = { value: JSON.parse(JSON.stringify(newData)) }; // Wrap in value property and deep clone
            const items = parentData[Constants.ITEMS_PROP] || {};

            if (items[itemKey]) {
                Object.keys(items[itemKey]).forEach(
                    (x) => (localData.value[x] = localData.value[x] || "")
                );
            }

            items[itemKey] = localData.value;
            parentData[Constants.ITEMS_PROP] = items;
            console.log('parent data after setting:', parentData);
        }
    }


    public getData<M extends Model>(path?: string | null, immutable = true): M | undefined {
        console.log(`getData called with path: ${path} immutable: ${immutable}`);
        if (!path) {
            return (immutable ? JSON.parse(JSON.stringify(this._data)) : this._data) as M;
        }

        if (path === this._rootPath || path === `${this._rootPath}/${Constants.JCR_CONTENT}`) {
            console.log('Returning root data:', this._data);
            return (immutable ? JSON.parse(JSON.stringify(this._data)) : this._data) as M;
        }

        const dataPaths = this.pathUtils.splitPageContentPaths(path);
        if (dataPaths) {
            const pageData = this._getPageData(dataPaths.pagePath);

            if (!pageData || !dataPaths.itemPath) {
                return (immutable ? JSON.parse(JSON.stringify(pageData)) : pageData) as M;
            }

            const result = this._findItemData(dataPaths.itemPath, pageData);
            if (result) {
                return (immutable ? JSON.parse(JSON.stringify(result.data)) : result.data) as M;
            }
        }
        return undefined;
    }

    public insertData(path: string, data: Model, siblingName?: string | null, insertBefore = false): void {
        data = JSON.parse(JSON.stringify(data)); // Deep clone

        if (!path) {
            console.warn(`No path provided for data: ${data}`);
            return;
        }

        const isItem = this.pathUtils.isItem(path);
        console.log('isItem:', isItem);
        if (!isItem) {
            if (this._data) {
                if (!this._data[Constants.CHILDREN_PROP]) {
                    this._data[Constants.CHILDREN_PROP] = {};
                }
                const childrenProp = this._data[Constants.CHILDREN_PROP];
                if (childrenProp) {
                    childrenProp[path] = data;
                }
            }
            return;
        }

        const dataPaths = this.pathUtils.splitPageContentPaths(path);
        console.log('Data paths:', dataPaths);
        if (dataPaths && dataPaths.itemPath) {
            const pageData = this._getPageData(dataPaths.pagePath);
            const result = this._findItemData(dataPaths.itemPath, pageData);
            const parent = result.parent || pageData || this._data;
            const itemName = this.pathUtils.getNodeName(dataPaths.itemPath);

            if (itemName && parent) {
                if (!parent[Constants.ITEMS_PROP]) {
                    parent[Constants.ITEMS_PROP] = {};
                }

                const items = parent[Constants.ITEMS_PROP]!;
                items[itemName] = data;

                if (!parent[Constants.ITEMS_ORDER_PROP]) {
                    parent[Constants.ITEMS_ORDER_PROP] = [];
                }

                const itemsOrder = parent[Constants.ITEMS_ORDER_PROP]!;
                if (siblingName) {
                    const index = itemsOrder.indexOf(siblingName);
                    if (index > -1) {
                        itemsOrder.splice(insertBefore ? index : index + 1, 0, itemName);
                    } else {
                        itemsOrder.push(itemName);
                    }
                } else {
                    itemsOrder.push(itemName);
                }
            }
        }
    }

    public removeData(path: string): string | null {
        if (!path) {
            return null;
        }

        const isItem = this.pathUtils.isItem(path);
        console.log('isItem:', isItem, 'for path:', path);
        console.log('data data:', this._data);

        if (!isItem) {
            if (this._data) {
                const childrenProp = this._data[Constants.CHILDREN_PROP];
                console.log('childrenProp: ', childrenProp);

                if (childrenProp && childrenProp[path]) {
                    delete childrenProp[path];
                    console.log('childrenProp after deletion:', childrenProp);
                }
            }
            return null;
        }

        const dataPaths = this.pathUtils.splitPageContentPaths(path);
        console.log('Data paths:', dataPaths);

        if (dataPaths && dataPaths.itemPath) {
            const pageData = this._getPageData(dataPaths.pagePath);
            console.log('Page data before removal:', pageData);
            const result = this._findItemData(dataPaths.itemPath, pageData);
            console.log('Find item data result:', result);

            if (result.data && result.parent) {
                const parentItems = result.parent[Constants.ITEMS_PROP];
                const itemName = this.pathUtils.getNodeName(dataPaths.itemPath);
                console.log('Item to remove:', itemName);

                if (parentItems && itemName && parentItems[itemName]) {
                    delete parentItems[itemName];
                    console.log('Parent items after deletion:', parentItems);

                    const itemsOrder = result.parent[Constants.ITEMS_ORDER_PROP];
                    if (itemsOrder) {
                        const index = itemsOrder.indexOf(itemName);
                        if (index > -1) {
                            itemsOrder.splice(index, 1);
                        }
                    }

                    console.log('Page data after removal:', pageData);
                    return result.parentPath || null;
                }
            }
        }

        console.warn(`Item for path ${path} was not found! Nothing to remove then.`);
        return null;
    }

    public destroy(): void {
        this._data = null;
        this._rootPath = null;
        this._pageContentDelimiter = null;
    }

    private _findItemData(
        path: string,
        data = this._data,
        parent: Model | undefined = undefined,
        parentPath = ""
    ): ItemWrapper {
        const answer: ItemWrapper = { parent, parentPath };

        if (!data) {
            throw new Error(
                "Assertion error: No data provided. This should never happen."
            );
        }

        const items = data[Constants.ITEMS_PROP];
        if (!items) return answer;

        for (const pathKey in items) {
            if (!Object.prototype.hasOwnProperty.call(items, pathKey)) continue;

            const childItem = items[pathKey];

            if (pathKey === path) {
                answer.data = items[pathKey];
                answer.key = pathKey;
                return answer;
            } else {
                let subPath = this.pathUtils.subpath(path, pathKey);
                if (this._pageContentDelimiter) {
                    const pageDelimiter = this.pathUtils._getStartStrings(
                        subPath,
                        this._pageContentDelimiter
                    );
                    const childParentPath = this.pathUtils.join([
                        parentPath,
                        pathKey,
                        pageDelimiter,
                    ]);
                    subPath = this.pathUtils.trimStrings(
                        subPath,
                        this._pageContentDelimiter
                    );

                    if (subPath !== path) {
                        const childItemWrapped = this._findItemData(
                            subPath,
                            childItem,
                            childItem,
                            childParentPath
                        );
                        if (childItemWrapped) {
                            return childItemWrapped;
                        }
                    }
                } else {
                    throw new Error(
                        "_pageContentDelimiter not set. This should never happen as it is set in the constructor."
                    );
                }
            }
        }

        return answer;
    }

    private _getPageData(pagePath: string): Model | undefined {
        if (!this._data) return;

        if (
            pagePath === "" ||
            pagePath === this._data[Constants.PATH_PROP] ||
            pagePath === this.rootPath
        ) {
            return this._data;
        }

        const children = this._data[Constants.CHILDREN_PROP];
        return children && children[pagePath];
    }
}
