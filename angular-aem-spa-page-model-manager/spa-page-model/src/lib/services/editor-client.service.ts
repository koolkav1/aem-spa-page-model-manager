import { Injectable, Inject } from '@angular/core';
import { EventType } from '../common/constants';
import { PathUtilsService } from '../utils/path.service';
import { ModelManagerService } from './model-manager.service';
import { deepClone } from '../common/deep-clone';

/**
 * The EditorClient is responsible for the interactions with the Page Editor.
 */
@Injectable({
  providedIn: 'root'
})
export class EditorClientService {
  private _windowListener: EventListenerOrEventListenerObject;

  constructor(
    private modelManager: ModelManagerService,
    private pathUtils: PathUtilsService
  ) {
    this._windowListener = this._handleWindowEvent.bind(this);

    if (this.pathUtils.isBrowser()) {
      window.addEventListener(EventType.PAGE_MODEL_UPDATE, this._windowListener);
    }
  }

  /**
   * Handle window event for page model update
   * @param event - Event object
   * @private
   */
  private _handleWindowEvent(event: Event) {
    const customEvent = event as CustomEvent;
    const msg = customEvent.detail?.msg;

    if (!msg) {
      console.error('EditorService.js', 'No message passed to cq-pagemodel-update', event);
      return;
    }

    this._updateModel(msg);
  }

  public triggerPageModelLoaded(model: any): void {
    // Deep copy to protect the internal state of the page model
    this.pathUtils.dispatchGlobalCustomEvent(EventType.PAGE_MODEL_LOADED, {
        detail: {
            model: deepClone(model)
        }
    });
}

  /**
   * Updates the page model with the given data
   *
   * @param msg - Object containing the data to update the page model
   * @property {string} msg.dataPath - Relative data path in the PageModel which needs to be updated
   * @property {string} msg.pagePath - Absolute page path corresponding to the page in the PageModel which needs to be updated
   * @property {string} msg.cmd - Command Action requested via Editable on the content Node
   * @property {object} msg.data - Data that needs to be updated in the PageModel at {path}
   * @fires cq-pagemodel-loaded
   * @private
   */
  private _updateModel(msg: { dataPath: string; pagePath: string; cmd: string; data: any; path: string }) {
    const { cmd, path, data } = msg;

    if (!cmd || !path) {
      console.error('PageModelManager.js', 'Not enough data received to update the page model');
      return;
    }

    const clonedData = JSON.parse(JSON.stringify(data));
    const parentNodePath = this.pathUtils.getParentNodePath(path) ?? undefined;

    switch (cmd) {
      case 'replace':
        this.modelManager.modelStore.setData(path, clonedData);
        this.modelManager._notifyListeners(path);
        break;
      case 'delete':
        this.modelManager.modelStore.removeData(path);
        if (parentNodePath) this.modelManager._notifyListeners(parentNodePath);
        break;
      case 'insertBefore':
        this._handleInsert(parentNodePath, path, clonedData, true);
        break;
      case 'insertAfter':
        this._handleInsert(parentNodePath, path, clonedData, false);
        break;
      default:
        console.log('EditorClient', 'unsupported command:', cmd);
    }

    this.triggerPageModelLoaded(this.modelManager.modelStore.dataMap);
  }

  /**
   * Handle insert commands (insertBefore and insertAfter)
   * @param parentNodePath - Parent node path
   * @param path - Path in the PageModel which needs to be updated
   * @param data - Data to be inserted
   * @param insertBefore - Flag indicating whether to insert before
   * @private
   */
  private _handleInsert(parentNodePath: string | undefined, path: string, data: any, insertBefore: boolean) {
    if (parentNodePath) {
      const siblingName = this.pathUtils.getNodeName(path);
      const itemPath = `${parentNodePath}/${data.key}`;
      this.modelManager.modelStore.insertData(itemPath, data.value, siblingName, insertBefore);
      this.modelManager._notifyListeners(parentNodePath);
    }
  }

  /**
   * @private
   */
  public destroy() {
    if (this.pathUtils.isBrowser()) {
      window.removeEventListener(EventType.PAGE_MODEL_UPDATE, this._windowListener);
    }
  }
}
