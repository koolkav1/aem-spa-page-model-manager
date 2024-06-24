import { TestBed } from '@angular/core/testing';
import { AuthoringUtilsService } from './authoring.service';
import { PathUtilsService } from './path.service';
import { DOMAIN_TOKEN } from '../common/domain-token';

describe('AuthoringUtilsService', () => {
  let service: AuthoringUtilsService;
  let pathUtilsService: PathUtilsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthoringUtilsService,
        PathUtilsService,
        { provide: DOMAIN_TOKEN, useValue: 'http://example.com' }
      ]
    });
    pathUtilsService = TestBed.inject(PathUtilsService);
    service = TestBed.inject(AuthoringUtilsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAemLibraries', () => {
    it('should return a DocumentFragment with script, link, and meta elements when in edit mode', () => {
      jest.spyOn(service, 'isRemoteApp').mockReturnValue(true);
      jest.spyOn(service, 'isEditMode').mockReturnValue(true);

      const docFragment = service.getAemLibraries();
      expect(docFragment).toBeInstanceOf(DocumentFragment);
      expect(docFragment.querySelectorAll('script').length).toBeGreaterThan(0);
      expect(docFragment.querySelectorAll('link').length).toBeGreaterThan(0);
      expect(docFragment.querySelectorAll('meta').length).toBeGreaterThan(0);
    });

    it('should return an empty DocumentFragment when not in edit mode', () => {
      jest.spyOn(service, 'isRemoteApp').mockReturnValue(false);
      jest.spyOn(service, 'isEditMode').mockReturnValue(false);

      const docFragment = service.getAemLibraries();
      expect(docFragment).toBeInstanceOf(DocumentFragment);
      expect(docFragment.childNodes.length).toBe(0);
    });
  });

  describe('setOnLoadCallback', () => {
    it('should call the callback immediately if no scripts are present', () => {
      const docFragment = document.createDocumentFragment();
      const callback = jest.fn();

      service.setOnLoadCallback(docFragment, callback);
      expect(callback).toHaveBeenCalled();
    });

    it('should call the callback after the last script is loaded', () => {
      const docFragment = document.createDocumentFragment();
      const script = document.createElement('script');
      docFragment.appendChild(script);
      const callback = jest.fn();

      service.setOnLoadCallback(docFragment, callback);
      script.onload?.(new Event('load'));
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('isMode', () => {
    it('should return true if mode matches meta property value', () => {
      jest.spyOn(pathUtilsService, 'getMetaPropertyValue').mockReturnValue('edit');
      jest.spyOn(pathUtilsService, 'isBrowser').mockReturnValue(false);

      expect(service['isMode']('edit')).toBe(true);
    });

    it('should return false if mode does not match meta property value or query parameter', () => {
      jest.spyOn(pathUtilsService, 'getMetaPropertyValue').mockReturnValue('preview');
      jest.spyOn(pathUtilsService, 'isBrowser').mockReturnValue(false);

      expect(service['isMode']('edit')).toBe(false);
    });
  });

  describe('isInEditor', () => {
    it('should return true if in edit mode', () => {
      jest.spyOn(service, 'isEditMode').mockReturnValue(true);

      expect(service.isInEditor()).toBe(true);
    });

    it('should return true if in preview mode', () => {
      jest.spyOn(service, 'isPreviewMode').mockReturnValue(true);

      expect(service.isInEditor()).toBe(true);
    });

    it('should return true if is remote app', () => {
      jest.spyOn(service, 'isRemoteApp').mockReturnValue(true);

      expect(service.isInEditor()).toBe(true);
    });

    it('should return false if not in edit mode, preview mode, or remote app', () => {
      jest.spyOn(service, 'isEditMode').mockReturnValue(false);
      jest.spyOn(service, 'isPreviewMode').mockReturnValue(false);
      jest.spyOn(service, 'isRemoteApp').mockReturnValue(false);

      expect(service.isInEditor()).toBe(false);
    });
  });
});
