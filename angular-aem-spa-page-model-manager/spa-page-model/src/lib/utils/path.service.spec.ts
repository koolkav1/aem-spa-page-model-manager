import { TestBed } from '@angular/core/testing';
import { PathUtilsService } from './path.service';

describe('PathUtilsService', () => {
  let service: PathUtilsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PathUtilsService]
    });
    service = TestBed.inject(PathUtilsService);
  });

  afterEach(() => {
    // Reset the document head after each test
    document.head.innerHTML = '';
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getMetaPropertyValue', () => {
    //Flakey test, passess in isolation
    it('should return the value of the meta property', async () => {
        document.head.innerHTML = '<meta property="cq:pagemodel_root_url" content="test-value">';

        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100ms

        const value = service.getMetaPropertyValue('cq:pagemodel_root_url');
        expect(value).toBe('test-value');
      });

      it('should return null if the meta property is not found', () => {
        expect(service.getMetaPropertyValue('nonexistent-property')).toBeNull();
      });

    it('should return null if the meta property is not found', () => {
      expect(service.getMetaPropertyValue('nonexistent-property')).toBeNull();
    });
  });

  describe('isBrowser', () => {
    it('should return true if running in the browser', () => {
      expect(service.isBrowser()).toBe(true);
    });

    it('should return false if not running in the browser', () => {
      const originalWindow = global['window'];
      Object.defineProperty(global, 'window', {
        value: undefined,
        configurable: true
      });

      expect(service.isBrowser()).toBe(false);

      Object.defineProperty(global, 'window', {
        value: originalWindow,
        configurable: true
      });
    });
  });

  describe('getContextPath', () => {
    it('should return empty string if no path is provided', () => {
      expect(service.getContextPath()).toBe('');
    });

    it('should return the context path of the given location', () => {
      const path = '/content/my-site/page';
      jest.spyOn(service, 'getCurrentPathname').mockReturnValue(path);
      expect(service.getContextPath(path)).toBe('/content');
    });

    it('should return empty string if the path does not contain a context path', () => {
      const path = '/unknown-path/page';
      jest.spyOn(service, 'getCurrentPathname').mockReturnValue(path);
      expect(service.getContextPath(path)).toBe('');
    });
  });




  describe('convertToModelUrl', () => {
    it('should return the URL with .model.json extension', () => {
      const url = '/content/my-site/page.html';
      expect(service.convertToModelUrl(url)).toBe('/content/my-site/page.model.json');
    });
  });

  describe('getCurrentPageModelUrl', () => {
    it('should return the current page model URL', () => {
      const path = '/content/my-site/page.html';
      jest.spyOn(service, 'getCurrentPathname').mockReturnValue(path);
      jest.spyOn(service, 'convertToModelUrl').mockReturnValue('/content/my-site/page.model.json');
      expect(service.getCurrentPageModelUrl()).toBe('/content/my-site/page.model.json');
    });
  });

  describe('getModelUrl', () => {
    it('should return the model URL from the provided URL', () => {
      const url = '/content/my-site/page.html';
      jest.spyOn(service, 'convertToModelUrl').mockReturnValue('/content/my-site/page.model.json');
      expect(service.getModelUrl(url)).toBe('/content/my-site/page.model.json');
    });

    it('should return the model URL from meta property if provided URL is not available', () => {
      jest.spyOn(service, 'getMetaPropertyValue').mockReturnValue('/content/my-site/page.model.json');
      expect(service.getModelUrl()).toBe('/content/my-site/page.model.json');
    });

    it('should return the current page model URL if no URL is provided and meta property is not available', () => {
      jest.spyOn(service, 'getMetaPropertyValue').mockReturnValue(null);
      jest.spyOn(service, 'getCurrentPageModelUrl').mockReturnValue('/content/my-site/page.model.json');
      expect(service.getModelUrl()).toBe('/content/my-site/page.model.json');
    });
  });
});
