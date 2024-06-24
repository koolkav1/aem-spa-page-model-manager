export interface Model {
    ":hierarchyType"?: string;

    ":path"?: string;

    ":children"?: { [key: string]: Model };

    ":items"?: { [key: string]: Model };

    ":itemsOrder"?: string[];

    ":type"?: string;

    [key: string]: any;
}
