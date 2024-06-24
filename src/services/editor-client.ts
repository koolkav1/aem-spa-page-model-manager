import { EventType } from "../common/constants";
import { PathUtils } from "../utils/path";
import { ModelManager } from "./model-manager";


/**
 * Broadcast an event to indicate the page model has been loaded
 * @param model - model item to be added to the broadcast payload
 * @fires cq-pagemodel-loaded
 * @private
 */
export function triggerPageModelLoaded(model: any): void {
    // Deep copy to protect the internal state of the page model
    PathUtils.dispatchGlobalCustomEvent(EventType.PAGE_MODEL_LOADED, {
        detail: {
            model: structuredClone(model)
        }
    });
}

/**
 * The EditorClient is responsible for the interactions with the Page Editor.
 * @private
 */
export class EditorClient {
    private _modelManager: ModelManager;
    private _windowListener: EventListenerOrEventListenerObject;

    constructor(modelManager: ModelManager) {
        this._modelManager = modelManager;
        this._windowListener = this._handleWindowEvent.bind(this);

        if (PathUtils.isBrowser()) {
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

        const clonedData = structuredClone(data);
        const parentNodePath = PathUtils.getParentNodePath(path) ?? undefined;

        switch (cmd) {
            case 'replace':
                this._modelManager.modelStore.setData(path, clonedData);
                this._modelManager._notifyListeners(path);
                break;
            case 'delete':
                this._modelManager.modelStore.removeData(path);
                if (parentNodePath) this._modelManager._notifyListeners(parentNodePath);
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

        triggerPageModelLoaded(this._modelManager.modelStore.dataMap);
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
            const siblingName = PathUtils.getNodeName(path);
            const itemPath = `${parentNodePath}/${data.key}`;
            this._modelManager.modelStore.insertData(itemPath, data.value, siblingName, insertBefore);
            this._modelManager._notifyListeners(parentNodePath);
        }
    }

    /**
     * @private
     */
    public destroy() {
        if (PathUtils.isBrowser()) {
            window.removeEventListener(EventType.PAGE_MODEL_UPDATE, this._windowListener);
        }
    }
}
