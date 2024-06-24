import { Constants, MetaProperty } from '../common/constants';
import { EditorClient, triggerPageModelLoaded } from './editor-client';
import { Model } from '../common/model.interface';
import { ModelClient } from './model-client';
import { ModelStore } from './model-store';
import { PathUtilsInterface } from '../common/path-utils.interface';
import { AuthoringUtils } from '../utils/authoring';
import { initModelRouter, isRouteExcluded } from './model-router';

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

    private pathUtils: PathUtilsInterface;

    constructor(pathUtils: PathUtilsInterface) {
        this.pathUtils = pathUtils;
    }

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

    public initialize<M extends Model>(config?: ModelManagerConfiguration | string): Promise<M> {
        this.initializeAsync(config);

        const { rootModelURL, rootModelPath } = this._modelPaths;
        if (!rootModelURL) throw new Error('Provide root model url to initialize ModelManager.');
        if (!rootModelPath) throw new Error('No root modelpath resolved! This should never happen.');

        return this._initPromise;
    }

    public initializeAsync(config?: ModelManagerConfiguration | string): void {
        this.destroy();
        const modelConfig = this._toModelConfig(config);
        const initialModel = modelConfig?.model;

        this._initializeFields(modelConfig);
        this._initPromise = this._attachAEMLibraries();

        const { rootModelPath } = this._modelPaths;
        this._modelStore = new ModelStore(rootModelPath, initialModel);
        if (rootModelPath) this._setInitializationPromise(rootModelPath);

        initModelRouter(this, this.pathUtils);
    }

    private _attachAEMLibraries() {
        if (!this.pathUtils.isBrowser()) return Promise.resolve();

        const docFragment = this.clientlibUtil.getAemLibraries();
        if (!docFragment.hasChildNodes()) return Promise.resolve();

        let outResolve: () => void;
        const promise = new Promise<void>(resolve => { outResolve = resolve; });

        this.clientlibUtil.setOnLoadCallback(docFragment, outResolve!);
        window.document.head.appendChild(docFragment);

        return promise;
    }

    private _initializeFields(config?: ModelManagerConfiguration) {
        this._listenersMap = {};
        this._fetchPromises = {};
        this._initPromise = null;

        this._modelClient = (config?.modelClient || new ModelClient());
        this._errorPageRoot = config?.errorPageRoot;
        this._editorClient = new EditorClient(this);
        this._clientlibUtil = new AuthoringUtils(this.modelClient.apiHost, this.pathUtils); // Pass pathUtils here
        this._modelPaths = this._getPathsForModel(config);
    }

    private _getPathsForModel(config?: ModelManagerConfiguration): ModelPaths {
        const path = config?.path;
        const pageModelRoot = this.pathUtils.getMetaPropertyValue(MetaProperty.PAGE_MODEL_ROOT_URL);
        const metaPropertyModelURL = this.pathUtils.internalize(pageModelRoot);

        const currentPathname: string | null = this._isRemoteApp() ? '' : this.pathUtils.getCurrentPathname();
        const sanitizedCurrentPathname = this.pathUtils.sanitize(currentPathname) || '';

        const rootModelURL = path || metaPropertyModelURL || sanitizedCurrentPathname;
        const rootModelPath = this.pathUtils.sanitize(rootModelURL) || '';

        return { currentPathname, metaPropertyModelURL, rootModelURL, rootModelPath };
    }

    private _fetchPageModelFromStore() {
        const data = this.modelStore.getData();
        triggerPageModelLoaded(data);
        return data;
    }

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

    private _fetchActivePageModel(rootModel: Model) {
        const { currentPathname, metaPropertyModelURL } = this._modelPaths;
        const sanitizedCurrentPathname = this.pathUtils.sanitize(currentPathname ?? '') || '';

        if (currentPathname && sanitizedCurrentPathname &&
            !isRouteExcluded(currentPathname, this.pathUtils) &&
            !this.isPageURLRoot(currentPathname, metaPropertyModelURL) &&
            !this.hasChildOfPath(rootModel, currentPathname)) {

            return this._fetchData(currentPathname).then((model: Model) => {
                this.modelStore.insertData(sanitizedCurrentPathname, model);
                return this._fetchPageModelFromStore();
            }).catch(console.warn);
        } else if (currentPathname && isRouteExcluded(currentPathname, this.pathUtils)) {
            return this._fetchPageModelFromStore();
        } else if (!this.pathUtils.isBrowser()) {
            throw new Error('Attempting to retrieve model data from a non-browser. Please provide the initial data with the property key model');
        }
    }


    public get rootPath(): string {
        return this.modelStore.rootPath;
    }

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

                if (this.pathUtils.isItem(path)) {
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

    public async _fetchData(path: string): Promise<Model> {
        if (await this._fetchPromises[path]) return this._fetchPromises[path];

        if (!this.modelClient) throw new Error('ModelClient not initialized!');

        return new Promise<Model>((resolve, reject) => {
            const promise = this.modelClient.fetch(this._toModelPath(path));
            this._fetchPromises[path] = promise;

            promise.then((obj: any) => {
                delete this._fetchPromises[path];
                if (this._isRemoteApp()) triggerPageModelLoaded(obj);
                resolve(obj);
            }).catch((error: { response: { status: any; }; }) => {
                delete this._fetchPromises[path];
                if (this._errorPageRoot) {
                    const code = typeof error !== 'string' && error.response ? error.response.status : '500';
                    const errorPagePath = `${this._errorPageRoot}${code}.model.json`;
                    if (path.indexOf(Constants.JCR_CONTENT) === -1 && path !== errorPagePath) {
                        this._fetchData(errorPagePath).then(response => {
                            response[Constants.PATH_PROP] = this.pathUtils.sanitize(path) || path;
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

    public _notifyListeners(path: string): void {
        const adaptedPath = this.pathUtils.adaptPagePath(path);
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

    public addListener(path: string, callback: ListenerFunction): void {
        if (!path || typeof path !== 'string' || typeof callback !== 'function') return;

        const adaptedPath = this.pathUtils.adaptPagePath(path, this.modelStore?.rootPath);
        this._listenersMap[adaptedPath] = this._listenersMap[adaptedPath] || [];
        this._listenersMap[adaptedPath].push(callback);
    }

    public removeListener(path: string, callback: ListenerFunction): void {
        if (!path || typeof path !== 'string' || typeof callback !== 'function') return;

        const adaptedPath = this.pathUtils.adaptPagePath(path, this.modelStore?.rootPath);
        const listenersForPath = this._listenersMap[adaptedPath];
        if (listenersForPath) {
            const index = listenersForPath.indexOf(callback);
            if (index !== -1) listenersForPath.splice(index, 1);
        }
    }

    private destroy() {
        this._modelClient?.destroy();
        this._modelStore?.destroy();
        this._editorClient?.destroy();
    }

    private _storeData(path: string, data: Model) {
        const isItem = this.pathUtils.isItem(path);
        if (data && Object.keys(data).length > 0) {
            this.modelStore.insertData(path, data);
            this._notifyListeners(path);
        }
        if (!isItem) this._notifyListeners('');
        return data;
    }

    private _toModelPath(path: string): string {
        let url = this.pathUtils.addSelector(path, 'model');
        url = this.pathUtils.addExtension(url, 'json');
        return this.pathUtils.makeAbsolute(this.pathUtils.externalize(url));
    }

    private _toModelConfig(config?: ModelManagerConfiguration | string): ModelManagerConfiguration {
        if (!config) return {};
        if (typeof config === 'string') return { path: config };
        return config;
    }

    private _checkDependencies() {
        if (!this.modelClient) return Promise.reject('No ModelClient registered.');
        if (!this.modelStore) return Promise.reject('No ModelManager registered.');
        return Promise.resolve();
    }

    private _getParentPage(path: string): Page {
        const dataPaths = this.pathUtils.splitPageContentPaths(path);
        const pagePath = dataPaths?.pagePath || '';
        const pageData = this.modelStore.getData(pagePath);
        return { pageData, pagePath };
    }

    public _isRemoteApp(): boolean {
        const aemApiHost = this.modelClient.apiHost || '';
        return this.pathUtils.isBrowser() && aemApiHost.length > 0 && (this.pathUtils.getCurrentURL() !== aemApiHost);
    }

    private hasChildOfPath(model: any, childPath: string): boolean {
        const sanitized = this.pathUtils.sanitize(childPath);
        if (!sanitized) return false;
        return !!(model && childPath && model[Constants.CHILDREN_PROP] && model[Constants.CHILDREN_PROP][sanitized]);
    }

    private isPageURLRoot(pagePath: string, modelRootPath: string | undefined): boolean {
        return !pagePath || !modelRootPath || (this.pathUtils.sanitize(pagePath) === this.pathUtils.sanitize(modelRootPath));
    }
}
