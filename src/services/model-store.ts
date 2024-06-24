import {Constants} from "../common/constants";
import { Model } from "../common/model.interface";
import { PathUtils } from "../utils/path";

/**
 * Item wrapper containing information about the item parent.
 * @private
 */
interface ItemWrapper {
    parent?: Model;
    parentPath?: string;
    data?: Model;
    key?: string;
}

/**
 * The ModelStore is in charge of providing access to the data model. It provides the CRUD operations over the model.
 * To protect the integrity of the data it initially returns immutable data. If needed, you can request a mutable object.
 */
export class ModelStore {
    private _pageContentDelimiter: string[] | null;
    private _data: Model | null = null;
    private _rootPath: string | null = null;

    /**
     * @param [rootPath] Root path of the model.
     * @param [data] Initial model.
     */
    constructor(rootPath?: string, data?: Model) {
        this._data = {};
        if (rootPath) {
            this.initialize(rootPath, data || {});
        }
        this._pageContentDelimiter = [Constants.JCR_CONTENT];
    }

    /**
     * Initializes the ModelStore.
     * @param rootPath Model root path.
     * @param data Initial model.
     */
    public initialize(rootPath: string, data: Model): void {
        this._data = data;
        this._rootPath = rootPath;
    }

    /**
     * Returns the current root path.
     * @returns Model root path.
     */
    public get rootPath(): string {
        return this._rootPath || "";
    }

    /**
     * Returns page model.
     * @returns Page model.
     */
    public get dataMap(): Model | null {
        return this._data;
    }

    /**
     * Replaces the data in the given location.
     * @param path Path of the data.
     * @param newData New data to be set.
     */
    public setData(path: string, newData: any = {}): void {
        const itemKey = PathUtils.getNodeName(path);
        if (!itemKey) return;

        const data = this.getData(PathUtils.getParentNodePath(path), false);
        if (data && data[Constants.ITEMS_PROP]) {
            const localData = structuredClone(newData);
            const items = data[Constants.ITEMS_PROP] || {};

            if (items[itemKey]) {
                Object.keys(items[itemKey]).forEach(
                    (x) => (localData.value[x] = localData.value[x] || "")
                );
            }

            items[itemKey] = localData.value;
            data[Constants.ITEMS_PROP] = items;
        }
    }

    /**
     * Returns the data for the given path. If no path is provided, it returns the whole data.
     * @param [path] Path to the data.
     * @param [immutable=true] Indicates whether a data structuredClone should be returned.
     * @return Data for given path, whole data or `undefined`.
     */
    public getData<M extends Model>(
        path?: string | null,
        immutable = true
    ): M | undefined {
        if (!path) {
            return (immutable ? structuredClone(this._data) : this._data) as M;
        }

        // Request for the root path returns the full data
        if (
            path === this._rootPath ||
            path === `${this._rootPath}/${Constants.JCR_CONTENT}`
        ) {
            return (immutable ? structuredClone(this._data) : this._data) as M;
        }

        const dataPaths = PathUtils.splitPageContentPaths(path);
        if (dataPaths) {
            const pageData = this._getPageData(dataPaths.pagePath);

            // Return the page data if no itemPath or no page data
            if (!pageData || !dataPaths.itemPath) {
                return (immutable ? structuredClone(pageData) : pageData) as M;
            }

            const result = this._findItemData(dataPaths.itemPath, pageData);
            if (result) {
                return (
                    immutable ? structuredClone(result.data) : result.data
                ) as M;
            }
        }
    }

    /**
     * Insert the provided data at the location of the given path.
     * If no sibling name is provided the data is added at the end of the list.
     * @param path Path to the data.
     * @param data Data to be inserted.
     * @param [siblingName] Name of the item before or after which to add the data.
     * @param [insertBefore=false] Should the data be inserted before the sibling.
     */
    public insertData(path: string, data: Model, siblingName?: string | null, insertBefore = false): void {
        data = structuredClone(data);

        if (!path) {
            console.warn(`No path provided for data: ${data}`);
            return;
        }

        const isItem = PathUtils.isItem(path);
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

        const dataPaths = PathUtils.splitPageContentPaths(path);
        if (dataPaths && dataPaths.itemPath) {
            const pageData = this._getPageData(dataPaths.pagePath);
            const result = this._findItemData(dataPaths.itemPath, pageData);
            const parent = result.parent || pageData || this._data;
            const itemName = PathUtils.getNodeName(dataPaths.itemPath);

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

    /**
     * Removes the data located at the provided location.
     * @param path Path of the data.
     * @return Path to the parent item initially containing the removed data, or `null`.
     */
    public removeData(path: string): string | null {
        if (!path) {
            return null;
        }

        const isItem = PathUtils.isItem(path);
        if (!isItem) {
            if (this._data) {
                const childrenProp = this._data[Constants.CHILDREN_PROP];
                if (childrenProp && childrenProp[path]) {
                    delete childrenProp[path];
                }
            }
            return null;
        }

        const dataPaths = PathUtils.splitPageContentPaths(path);
        if (dataPaths && dataPaths.itemPath) {
            const pageData = this._getPageData(dataPaths.pagePath);
            const result = this._findItemData(dataPaths.itemPath, pageData);

            if (result.data && result.parent) {
                const parentItems = result.parent[Constants.ITEMS_PROP];
                const itemName = PathUtils.getNodeName(dataPaths.itemPath);

                if (parentItems && itemName && parentItems[itemName]) {
                    delete parentItems[itemName];
                    delete result.data;

                    const itemsOrder = result.parent[Constants.ITEMS_ORDER_PROP];
                    if (itemsOrder) {
                        const index = itemsOrder.indexOf(itemName);
                        if (index > -1) {
                            itemsOrder.splice(index, 1);
                        }
                    }

                    return result.parentPath || null;
                }
            }
        }

        console.warn(`Item for path ${path} was not found! Nothing to remove then.`);
        return null;
    }

    /**
     * Destroys the internal references to avoid memory leaks.
     */
    public destroy(): void {
        this._data = null;
        this._rootPath = null;
        this._pageContentDelimiter = null;
    }

    /**
     * Retrieves the item and eventually returns the data wrapped with the parent information.
     * @param path Path of the item.
     * @param [data=_data] Data to be explored (must not be null!)
     * @param [parent] Parent data.
     * @param  [parentPath=''] Path of the parent data.
     * @private
     * @return
     */
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
                let subPath = PathUtils.subpath(path, pathKey);
                if (this._pageContentDelimiter) {
                    const pageDelimiter = PathUtils._getStartStrings(
                        subPath,
                        this._pageContentDelimiter
                    );
                    const childParentPath = PathUtils.join([
                        parentPath,
                        pathKey,
                        pageDelimiter,
                    ]);
                    subPath = PathUtils.trimStrings(
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

    /**
     * @param pagePath Path of the page.
     * @private
     * @return Data of the page.
     */
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
