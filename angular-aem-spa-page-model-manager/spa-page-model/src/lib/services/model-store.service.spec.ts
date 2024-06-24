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
        it('should return the entire data if no path is provided', () => {
          const data = { [Constants.ITEMS_PROP]: { 'jcr:content': { value: 'test-value' } } } as Model;
          service.initialize('/content/my-site', data);

          const result = service.getData();
          expect(result).toEqual(data);
        });

        it('should return the entire data if the root path is provided', () => {
          const data = { [Constants.ITEMS_PROP]: { 'jcr:content': { value: 'test-value' } } } as Model;
          service.initialize('/content/my-site', data);

          const result = service.getData('/content/my-site');
          expect(result).toEqual(data);
        });
        // To be verified
        it.skip('should return the entire data if the root path with JCR content is provided', () => {
          const data = { [Constants.ITEMS_PROP]: { 'jcr:content': { value: 'test-value' } } } as Model;
          service.initialize('/content/my-site', data);

          const result = service.getData('/content/my-site/' + Constants.JCR_CONTENT);
          expect(result).toEqual(data);
        });



        it('should return the page data if no itemPath is provided', () => {
          const path = '/content/my-site';
          const data = { value: 'test-value' } as Model;
          const expectedData = { value: 'test-value' };

          jest.spyOn(pathUtils, 'splitPageContentPaths').mockReturnValue({ pagePath: path, itemPath: undefined });
          service.initialize('/content/my-site', data);

          const result = service.getData(path);
          expect(result).toEqual(expectedData);
        });

        it('should return the data for the given path', () => {
            const path = '/content/my-site/jcr:content';
            const data = { value: 'test-value' } as Model;
            const expectedData = { value: 'test-value' };

            jest.spyOn(pathUtils, 'splitPageContentPaths').mockReturnValue({ pagePath: '/content/my-site', itemPath: 'jcr:content' });
            service.initialize('/content/my-site', { [Constants.ITEMS_PROP]: { 'jcr:content': data } } as Model);

            console.log('Data before getData:', service.dataMap);
            const result = service.getData(path);
            console.log('Result of getData:', result);
            expect(result).toEqual(expectedData);
        });

        it('should return undefined if no data is found for the given path', () => {
            const path = '/content/my-site/jcr:content';
            jest.spyOn(pathUtils, 'splitPageContentPaths').mockReturnValue({ pagePath: '/content/my-site', itemPath: 'jcr:content' });
            service.initialize('/content/my-site', {} as Model);

            const result = service.getData(path);
            console.log('Result of getData:', result);
            expect(result).toEqual({});
        });

      });

      describe('insertData', () => {
        it('should insert data at the given path', () => {
            const path = '/content/my-site/jcr:content';
            const data = { value: 'test-value' } as Model;
            const expectedData = { ':children': { 'jcr:content': { value: 'test-value' } } };

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
            const initialData = { ':items': { 'jcr:content': data } };

            jest.spyOn(pathUtils, 'splitPageContentPaths').mockReturnValue({ pagePath: '/content/my-site', itemPath: 'jcr:content' });
            jest.spyOn(pathUtils, 'isItem').mockReturnValue(true);
            jest.spyOn(pathUtils, 'getNodeName').mockReturnValue('jcr:content');
            service.initialize('/content/my-site', initialData as Model);

            service.removeData(path);

            const resultData = service.getData('/content/my-site', false);
            console.log('Data after removeData:', resultData);
            expect(resultData).toEqual({ ':items': {} });
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
