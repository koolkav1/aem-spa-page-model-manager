import Constants from './Constants';
import { EditorClient, triggerPageModelLoaded } from './EditorClient';
import MetaProperty from './MetaProperty';
import { Model } from './Model';
import { ModelClient } from './ModelClient';
import { ModelStore } from './ModelStore';
import { PathUtils } from './PathUtils';
import { AuthoringUtils } from './AuthoringUtils';
import { initModelRouter, isRouteExcluded } from './ModelRouter';

/**
 * Checks whether provided child path exists in the model.
 * @param model Model to be evaluated.
 * @param childPath Path of the child.
 * @private
 * @returns `true` if childPath exists in the model.
 */
function hasChildOfPath(model: any, childPath: string): boolean {
    const sanitized = PathUtils.sanitize(childPath);
    if (!sanitized) return false;
    return !!(model && childPath && model[Constants.CHILDREN_PROP] && model[Constants.CHILDREN_PROP][sanitized]);
}

/**
 * Checks whether provided path corresponds to model root path.
 * @param pagePath Page model path.
 * @param modelRootPath Model root path.
 * @returns `true` if provided page path is root
 * @private
 */
function isPageURLRoot(pagePath: string, modelRootPath: string | undefined): boolean {
    return !pagePath || !modelRootPath || (PathUtils.sanitize(pagePath) === PathUtils.sanitize(modelRootPath));
}

export interface ModelManagerConfiguration {
    forceReload?: boolean;
    model?: Model;
    modelClient?: ModelClient;
    path?: string;
    errorPageRoot?: string;
}

interface ModelPaths {
    rootModelURL?: string;
    rootModelPath?: string;
    currentPathname?: string | null;
    metaPropertyModelURL?: string;
}

interface Page {
    pagePath: string;
    pageData?: Model;
}

/**
 * @private
 */
export type ListenerFunction = () => void;

/**
 * ModelManager is the main entry point of this module.
 */
export class ModelManager {
    private _modelClient?: ModelClient;
    private _modelStore?: ModelStore;
    private _listenersMap: { [key: string]: ListenerFunction[] } = {};
    private _fetchPromises: { [key: string]: Promise<Model> } = {};
    private _initPromise: any;
    private _editorClient?: EditorClient;
    private _clientlibUtil?: AuthoringUtils;
    private _modelPaths: ModelPaths = {};
    private _errorPageRoot?: string;

    public get modelClient(): ModelClient {
        if (!this._modelClient) throw new Error('ModelClient is undefined. Call initialize first!');
        return this._modelClient;
    }

    public get modelStore(): ModelStore {
        if (!this._modelStore) throw new Error('ModelStore is undefined. Call initialize first!');
        return this._modelStore;
    }

    public get clientlibUtil(): AuthoringUtils {
        if (!this._clientlibUtil) throw new Error('AuthoringUtils is undefined. Call initialize first!');
        return this._clientlibUtil;
    }

    /**
     * Initializes the ModelManager using the given path to resolve a data model.
     * If no path is provided, fallbacks are applied in the following order:
     * - meta property: `cq:pagemodel_root_url`
     * - current path of the page
     *
     * @fires cq-pagemodel-loaded
     * @return {Promise}
     */
    public initialize<M extends Model>(config?: ModelManagerConfiguration | string): Promise<M> {
        this.initializeAsync(config);

        const { rootModelURL, rootModelPath } = this._modelPaths;
        if (!rootModelURL) throw new Error('Provide root model url to initialize ModelManager.');
        if (!rootModelPath) throw new Error('No root modelpath resolved! This should never happen.');

        return this._initPromise;
    }

    /**
     * Initializes the ModelManager asynchronously using the given path to resolve a data model.
     *
     * @fires cq-pagemodel-loaded if root model path is available
     */
    public initializeAsync(config?: ModelManagerConfiguration | string): void {
        this.destroy();
        const modelConfig = this._toModelConfig(config);
        const initialModel = modelConfig?.model;

        this._initializeFields(modelConfig);
        this._initPromise = this._attachAEMLibraries();

        const { rootModelPath } = this._modelPaths;
        this._modelStore = new ModelStore(rootModelPath, initialModel);
        if (rootModelPath) this._setInitializationPromise(rootModelPath);

        initModelRouter();
    }

    /**
     * Attaches detected in runtime required libraries to enable special AEM authoring capabilities.
     *
     * @private
     */
    private _attachAEMLibraries() {
        if (!PathUtils.isBrowser()) return Promise.resolve();

        const docFragment = this.clientlibUtil.getAemLibraries();
        if (!docFragment.hasChildNodes()) return Promise.resolve();

        let outResolve: () => void;
        const promise = new Promise<void>(resolve => { outResolve = resolve; });

        this.clientlibUtil.setOnLoadCallback(docFragment, outResolve!);
        window.document.head.appendChild(docFragment);

        return promise;
    }

    /**
     * Initializes the class fields for ModelManager
     */
    private _initializeFields(config?: ModelManagerConfiguration) {
        this._listenersMap = {};
        this._fetchPromises = {};
        this._initPromise = null;

        this._modelClient = (config?.modelClient || new ModelClient());
        this._errorPageRoot = config?.errorPageRoot;
        this._editorClient = new EditorClient(this);
        this._clientlibUtil = new AuthoringUtils(this.modelClient.apiHost);
        this._modelPaths = this._getPathsForModel(config);
    }

    /**
     * Returns paths required for fetching root model
     */
    private _getPathsForModel(config?: ModelManagerConfiguration): ModelPaths {
        const path = config?.path;
        const pageModelRoot = PathUtils.getMetaPropertyValue(MetaProperty.PAGE_MODEL_ROOT_URL);
        const metaPropertyModelURL = PathUtils.internalize(pageModelRoot);

        const currentPathname: string | null = this._isRemoteApp() ? '' : PathUtils.getCurrentPathname();
        const sanitizedCurrentPathname = PathUtils.sanitize(currentPathname) || '';

        const rootModelURL = path || metaPropertyModelURL || sanitizedCurrentPathname;
        const rootModelPath = PathUtils.sanitize(rootModelURL) || '';

        return { currentPathname, metaPropertyModelURL, rootModelURL, rootModelPath };
    }

    /**
     * Fetch page model from store and trigger cq-pagemodel-loaded event
     * @returns Root page model
     */
    private _fetchPageModelFromStore() {
        const data = this.modelStore.getData();
        triggerPageModelLoaded(data);
        return data;
    }

    /**
     * Sets initialization promise to fetch model if root path is available
     */
    private _setInitializationPromise(rootModelPath: string) {
        const { rootModelURL } = this._modelPaths;

        this._initPromise = this._initPromise
            .then(() => this._checkDependencies())
            .then(() => {
                const data = this.modelStore.getData(rootModelPath);
                if (data && Object.keys(data).length > 0) {
                    triggerPageModelLoaded(data);
                    return data;
                } else if (rootModelURL) {
                    return this._fetchData(rootModelURL).then((rootModel: Model) => {
                        this.modelStore.initialize(rootModelPath, rootModel);
                        return this._fetchActivePageModel(rootModel) || this._fetchPageModelFromStore();
                    }).catch(console.error);
                }
            });
    }

    /**
     * Fetch model for the currently active page
     */
    private _fetchActivePageModel(rootModel: Model) {
        const { currentPathname, metaPropertyModelURL } = this._modelPaths;
        const sanitizedCurrentPathname = PathUtils.sanitize(currentPathname ?? '') || '';

        if (currentPathname && sanitizedCurrentPathname &&
            !isRouteExcluded(currentPathname) &&
            !isPageURLRoot(currentPathname, metaPropertyModelURL) &&
            !hasChildOfPath(rootModel, currentPathname)) {

            return this._fetchData(currentPathname).then((model: Model) => {
                this.modelStore.insertData(sanitizedCurrentPathname, model);
                return this._fetchPageModelFromStore();
            }).catch(console.warn);
        } else if (currentPathname && isRouteExcluded(currentPathname)) {
            return this._fetchPageModelFromStore();
        } else if (!PathUtils.isBrowser()) {
            throw new Error('Attempting to retrieve model data from a non-browser. Please provide the initial data with the property key model');
        }
    }

    /**
     * Returns the path of the data model root.
     * @returns Page model root path.
     */
    public get rootPath(): string {
        return this.modelStore.rootPath;
    }

    /**
     * Returns the model for the given configuration.
     * @param [config] Either the path of the data model or a configuration object. If no parameter is provided the complete model is returned.
     * @returns Model object for specific path.
     */
    public getData<M extends Model>(config?: ModelManagerConfiguration | string): Promise<M> {
        let path = '';
        let forceReload = false;

        if (typeof config === 'string') {
            path = config;
        } else if (config) {
            path = config.path || '';
            forceReload = !!config.forceReload;
        }

        const initPromise = this._initPromise || Promise.resolve();
        return initPromise
            .then(() => this._checkDependencies())
            .then(() => {
                if (!forceReload) {
                    const item = this.modelStore.getData(path);
                    if (item) return Promise.resolve(item);
                }

                if (PathUtils.isItem(path)) {
                    const { pageData, pagePath } = this._getParentPage(path);
                    if (!pageData) {
                        return this._fetchData(pagePath).then((data: Model) => {
                            this._storeData(pagePath, data);
                            return this.modelStore.getData(path);
                        });
                    }
                }

                return this._fetchData(path).then((data: Model) => this._storeData(path, data));
            });
    }

    /**
     * Fetches the model for the given path.
     * @param path Model path.
     * @private
     * @returns Model object for specific path.
     */
    public async _fetchData(path: string): Promise<Model> {
        if (await this._fetchPromises[path]) return this._fetchPromises[path];

        if (!this.modelClient) throw new Error('ModelClient not initialized!');

        return new Promise<Model>((resolve, reject) => {
            const promise = this.modelClient.fetch(this._toModelPath(path));
            this._fetchPromises[path] = promise;

            promise.then(obj => {
                delete this._fetchPromises[path];
                if (this._isRemoteApp()) triggerPageModelLoaded(obj);
                resolve(obj);
            }).catch(error => {
                delete this._fetchPromises[path];
                if (this._errorPageRoot) {
                    const code = typeof error !== 'string' && error.response ? error.response.status : '500';
                    const errorPagePath = `${this._errorPageRoot}${code}.model.json`;
                    if (path.indexOf(Constants.JCR_CONTENT) === -1 && path !== errorPagePath) {
                        this._fetchData(errorPagePath).then(response => {
                            response[Constants.PATH_PROP] = PathUtils.sanitize(path) || path;
                            resolve(response);
                        }).catch(reject);
                    } else {
                        reject(error);
                    }
                } else {
                    reject(error);
                }
            });
        });
    }

    /**
     * Notifies the listeners for a given path.
     * @param path Path of the data model.
     * @private
     */
    public _notifyListeners(path: string): void {
        const adaptedPath = PathUtils.adaptPagePath(path);
        if (!this._listenersMap) throw new Error('ListenersMap is undefined.');
        const listenersForPath = this._listenersMap[adaptedPath];
        if (!listenersForPath) return;

        listenersForPath.forEach(listener => {
            try {
                listener();
            } catch (e) {
                console.error(`Error in listener ${listenersForPath} at path ${path}: ${e}`);
            }
        });
    }

    /**
     * Add the given callback as a listener for changes at the given path.
     * @param path Absolute path of the resource (e.g., "/content/mypage"). If not provided, the root page path is used.
     * @param callback Function to be executed listening to changes at given path.
     */
    public addListener(path: string, callback: ListenerFunction): void {
        if (!path || typeof path !== 'string' || typeof callback !== 'function') return;

        const adaptedPath = PathUtils.adaptPagePath(path, this.modelStore?.rootPath);
        this._listenersMap[adaptedPath] = this._listenersMap[adaptedPath] || [];
        this._listenersMap[adaptedPath].push(callback);
    }

    /**
     * Remove the callback listener from the given path path.
     * @param path Absolute path of the resource (e.g., "/content/mypage"). If not provided, the root page path is used.
     * @param callback Listener function to be removed.
     */
    public removeListener(path: string, callback: ListenerFunction): void {
        if (!path || typeof path !== 'string' || typeof callback !== 'function') return;

        const adaptedPath = PathUtils.adaptPagePath(path, this.modelStore?.rootPath);
        const listenersForPath = this._listenersMap[adaptedPath];
        if (listenersForPath) {
            const index = listenersForPath.indexOf(callback);
            if (index !== -1) listenersForPath.splice(index, 1);
        }
    }

    /**
     * Destroys the ModelManager, cleaning up resources.
     */
    private destroy() {
        this._modelClient?.destroy();
        this._modelStore?.destroy();
        this._editorClient?.destroy();
    }

    private _storeData(path: string, data: Model) {
        const isItem = PathUtils.isItem(path);
        if (data && Object.keys(data).length > 0) {
            this.modelStore.insertData(path, data);
            this._notifyListeners(path);
        }
        if (!isItem) this._notifyListeners('');
        return data;
    }

    /**
     * Transforms the given path into a model URL.
     * @private
     */
    private _toModelPath(path: string): string {
        let url = PathUtils.addSelector(path, 'model');
        url = PathUtils.addExtension(url, 'json');
        return PathUtils.makeAbsolute(PathUtils.externalize(url));
    }

    /**
     * Transforms the given config into a ModelManagerConfiguration object
     * @private
     */
    private _toModelConfig(config?: ModelManagerConfiguration | string): ModelManagerConfiguration {
        if (!config) {
            return {};
        }
        if (typeof config === 'string') {
            return { path: config };
        }
        return config;
    }

    /**
     * Verifies the integrity of the provided dependencies
     * @private
     */
    private _checkDependencies() {
        if (!this.modelClient) return Promise.reject('No ModelClient registered.');
        if (!this.modelStore) return Promise.reject('No ModelManager registered.');
        return Promise.resolve();
    }

    /**
     * Fetches parent page information of the given component path
     * @private
     */
    private _getParentPage(path: string): Page {
        const dataPaths = PathUtils.splitPageContentPaths(path);
        const pagePath = dataPaths?.pagePath || '';
        const pageData = this.modelStore.getData(pagePath);
        return { pageData, pagePath };
    }

    /**
     * Checks if the currently open app in AEM editor is a remote app
     * @returns true if remote app
     */
    public _isRemoteApp(): boolean {
        const aemApiHost = this.modelClient.apiHost || '';
        return PathUtils.isBrowser() && aemApiHost.length > 0 && (PathUtils.getCurrentURL() !== aemApiHost);
    }
}

export default new ModelManager();
