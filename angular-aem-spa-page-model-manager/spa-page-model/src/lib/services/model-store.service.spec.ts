import { TestBed } from '@angular/core/testing';
import { ModelStoreService } from './model-store.service';
import { PathUtilsService } from '../utils/path.service';
import { Constants } from '../common/constants';
import { Model } from '../common/model.interface';

describe('ModelStoreService', () => {
    let service: ModelStoreService;
    let pathUtils: PathUtilsService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [ModelStoreService, PathUtilsService]
        });
        service = TestBed.inject(ModelStoreService);
        pathUtils = TestBed.inject(PathUtilsService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('initialize', () => {
        it('should initialize with the provided root path and data', () => {
            const rootPath = '/content/my-site';
            const data = { [Constants.PATH_PROP]: rootPath } as Model;
            service.initialize(rootPath, data);
            expect(service.rootPath).toBe(rootPath);
            expect(service.dataMap).toEqual(data);
        });
    });

    describe('setData', () => {
        it('should set data at the given path', () => {
            const path = '/content/my-site/jcr:content';
            const data = { value: 'test-value' };
            const expectedData = { ':items': { 'jcr:content': { value: 'test-value' } } };

            jest.spyOn(pathUtils, 'getNodeName').mockReturnValue('jcr:content');
            jest.spyOn(pathUtils, 'getParentNodePath').mockReturnValue('/content/my-site');
            service.initialize('/content/my-site', { [Constants.ITEMS_PROP]: {} } as Model);

            service.setData(path, data);

            console.log('Data after setData:', service.getData('/content/my-site', false));
            expect(service.getData('/content/my-site', false)).toEqual(expectedData);
        });
    });

    describe('getData', () => {
        it('should return the data for the given path', async () => {
            const path = '/content/my-site/jcr:content';
            const data = { value: 'test-value' } as Model;
            const expectedData = { 'value': 'test-value' };

            jest.spyOn(pathUtils, 'splitPageContentPaths').mockReturnValue({ pagePath: '/content/my-site', itemPath: 'jcr:content' });
            service.initialize('/content/my-site', { [Constants.ITEMS_PROP]: { 'jcr:content': data } } as Model);

            console.log('Data before getData:', service.dataMap);
            const result = service.getData(path);
            await new Promise(resolve => setTimeout(resolve, 200));
            console.log('Result of getData:', result);
            expect(result).toMatchObject(expectedData);
        });

        it('should return undefined if no data is found', () => {
            const path = '/content/my-site/jcr:content';
            jest.spyOn(pathUtils, 'splitPageContentPaths').mockReturnValue({ pagePath: '/content/my-site', itemPath: 'jcr:content' });
            service.initialize('/content/my-site', {} as Model);

            const result = service.getData(path);
            console.log('Result of getData:', result);
            expect(result).toBeUndefined();
        });
    });

    describe('insertData', () => {
        it('should insert data at the given path', () => {
            const path = '/content/my-site/jcr:content';
            const data = { value: 'test-value' } as Model;
            const expectedData = { ':items': { 'jcr:content': { value: 'test-value' } } };

            jest.spyOn(pathUtils, 'splitPageContentPaths').mockReturnValue({ pagePath: '/content/my-site', itemPath: 'jcr:content' });
            service.initialize('/content/my-site', {} as Model);

            service.insertData(path, data);

            console.log('Data after insertData:', service.getData('/content/my-site', false));
            expect(service.getData('/content/my-site', false)).toEqual(expectedData);
        });
    });

    describe('removeData', () => {
        it('should remove data at the given path', () => {
            const path = '/content/my-site/jcr:content';
            const data = { value: 'test-value' } as Model;
            const expectedData = { ':items': {} };

            jest.spyOn(pathUtils, 'splitPageContentPaths').mockReturnValue({
                pagePath: '/content/my-site',
                itemPath: 'jcr:content',
            });
            service.initialize('/content/my-site', {
                [Constants.ITEMS_PROP]: { 'jcr:content': data },
            } as Model);

            service.removeData(path);

            console.log('Data after removeData:', service.getData('/content/my-site', false));
            expect(service.getData(path)).toBeUndefined();
        });
    });

    describe('destroy', () => {
        it('should destroy the internal data', () => {
            const rootPath = '/content/my-site';
            const data = { [Constants.PATH_PROP]: rootPath } as Model;
            service.initialize(rootPath, data);

            service.destroy();

            expect(service.dataMap).toBeNull();
            expect(service.rootPath).toBe('');
        });
    });
});
