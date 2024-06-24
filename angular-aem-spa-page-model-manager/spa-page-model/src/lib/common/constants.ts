import { Model } from "./model.interface";

export const Constants = {
    TYPE_PROP: ':type',
    ITEMS_PROP : ':items',
    ITEMS_ORDER_PROP : ':itemsOrder',
    PATH_PROP : ':path',
    CHILDREN_PROP : ':children',
    HIERARCHY_TYPE_PROP : ':hierarchyType',
    JCR_CONTENT : 'jcr:content'
}

export enum AEM_MODE {
    EDIT = 'edit',
    PREVIEW = 'preview',
    DISABLED = 'disabled'
}
export enum TAG_TYPE {
    JS = 'script',
    STYLESHEET = 'stylesheet'
}

export enum MetaProperty {
    PAGE_MODEL_ROOT_URL = 'cq:pagemodel_root_url',
    PAGE_MODEL_ROUTE_FILTERS = 'cq:pagemodel_route_filters',
    PAGE_MODEL_ROUTER = 'cq:pagemodel_router',
    WCM_MODE = 'cq:wcmmode',
    WCM_DATA_TYPE = 'cq:datatype',
}

export enum EventType {
    PAGE_MODEL_INIT = 'cq-pagemodel-init',
    PAGE_MODEL_LOADED = 'cq-pagemodel-loaded',
    PAGE_MODEL_UPDATE = 'cq-pagemodel-update',
    PAGE_MODEL_ROUTE_CHANGED = 'cq-pagemodel-route-changed',
}

export interface ItemWrapper {
    parent?: Model;
    parentPath?: string;
    data?: Model;
    key?: string;
}
