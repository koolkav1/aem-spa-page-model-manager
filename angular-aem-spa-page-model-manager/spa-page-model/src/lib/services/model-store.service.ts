import { Injectable } from '@angular/core';
import { Constants } from '../common/constants';
import { Model } from '../common/model.interface';
import { PathUtilsService } from '../utils/path.service';

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
@Injectable({
  providedIn: 'root'
})
export class ModelStoreService {
  private _pageContentDelimiter: string[] | null;
  private _data: Model | null = null;
  private _rootPath: string | null = null;

  constructor(private pathUtils: PathUtilsService) {
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
    const itemKey = this.pathUtils.getNodeName(path);
    if (!itemKey) return;

    const data = this.getData(this.pathUtils.getParentNodePath(path), false);
    if (data && data[Constants.ITEMS_PROP]) {
      const localData = this.deepClone({ value: newData });
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

  public getData<M extends Model>(
    path?: string | null,
    immutable = true
): M | undefined {
    console.log(`getData called with path: ${path} immutable: ${immutable}`);
    if (!path) {
        console.log('Returning full data:', this._data);
        return (immutable ? this.deepClone(this._data) : this._data) as M;
    }



    const dataPaths = this.pathUtils.splitPageContentPaths(path);
    console.log('splitPageContentPaths result:', dataPaths);
    if (dataPaths) {
        const pageData = this._getPageData(dataPaths.pagePath);
        console.log('Page data:', pageData);

        if (!pageData || !dataPaths.itemPath) {
            console.log('Returning page data:', pageData);
            return (immutable ? this.deepClone(pageData) : pageData) as M;
        }

        const result = this._findItemData(dataPaths.itemPath, pageData);
        console.log('findItemData result:', result);
        if (result && result.data) {
            return (immutable ? this.deepClone(result.data) : result.data) as M;
        } else {
            console.log('Item data not found for itemPath:', dataPaths.itemPath);
        }
    }
    if (
        path === this._rootPath ||
        path === `${this._rootPath}/${Constants.JCR_CONTENT}`
    ) {
        console.log('Returning root data:', this._data);
        return (immutable ? this.deepClone(this._data) : this._data) as M;
    }

    console.log('No data found for path:', path);
    return undefined;
}



public insertData(
    path: string,
    data: Model,
    siblingName?: string | null,
    insertBefore = false
): void {
    console.log(`insertData called with path: ${path}, data: ${JSON.stringify(data)}`);
    const deepClonedData = this.deepClone(data);

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
            const nodeName = this.pathUtils.getNodeName(path);
            if (childrenProp && nodeName) {
                childrenProp[nodeName] = deepClonedData;
            }
        }
        return;
    }

    const dataPaths = this.pathUtils.splitPageContentPaths(path);
    console.log('splitPageContentPaths result:', dataPaths);
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
            items[itemName] = deepClonedData;

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
    console.log(`removeData called with path: ${path}`);

    if (!path) {
        return null;
    }

    const isItem = this.pathUtils.isItem(path);
    console.log(`isItem: ${isItem} for path: ${path}`);
    if (!isItem) {
        if (this._data) {
            const childrenProp = this._data[Constants.CHILDREN_PROP];
            console.log('childrenProp:', childrenProp);
            if (childrenProp && childrenProp[path]) {
                delete childrenProp[path];
                return null;
            }
        }
        return null;
    }

    const dataPaths = this.pathUtils.splitPageContentPaths(path);
    console.log('splitPageContentPaths result:', dataPaths);
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

  // Utility function for deep cloning objects
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof Object) {
      const copy: { [key: string]: any } = {};
      Object.keys(obj).forEach(key => {
        copy[key] = this.deepClone(obj[key]);
      });
      return copy;
    }

    throw new Error('Unable to copy obj! Its type isn\'t supported.');
  }
}
