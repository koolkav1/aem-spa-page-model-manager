export interface ModelManagerInterface {
    getData(params: { path: string }): Promise<any>;
}
