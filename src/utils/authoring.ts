import { PathUtilsInterface } from '../common/path-utils.interface';

export class AuthoringUtils {
    private readonly _apiDomain: string | null;
    private pathUtils: PathUtilsInterface;

    public static readonly EDITOR_CLIENTLIB_PATH = '/etc.clientlibs/cq/gui/components/authoring/editors/clientlibs/';
    public static readonly AUTHORING_LIBRARIES = {
        JS: [
            `${AuthoringUtils.EDITOR_CLIENTLIB_PATH}internal/messaging.js`,
            `${AuthoringUtils.EDITOR_CLIENTLIB_PATH}utils.js`,
            `${AuthoringUtils.EDITOR_CLIENTLIB_PATH}internal/page.js`,
            `${AuthoringUtils.EDITOR_CLIENTLIB_PATH}internal/pagemodel/messaging.js`
        ],
        CSS: [
            `${AuthoringUtils.EDITOR_CLIENTLIB_PATH}internal/page.css`
        ],
        META: {
            'cq:wcmmode': 'disabled'
        }
    };

    constructor(domain: string | null, pathUtils: PathUtilsInterface) {
        this._apiDomain = domain;
        this.pathUtils = pathUtils;
    }

    getApiDomain(): string | null {
        return this._apiDomain;
    }

    public getAemLibraries(): DocumentFragment {
        const docFragment = document.createDocumentFragment();

        if (!this.isRemoteApp() || !this.isEditMode()) {
            return docFragment;
        }

        const jsUrls = this.prependDomain(AuthoringUtils.AUTHORING_LIBRARIES.JS);
        const cssUrls = this.prependDomain(AuthoringUtils.AUTHORING_LIBRARIES.CSS);
        const metaInfo = AuthoringUtils.AUTHORING_LIBRARIES.META;

        docFragment.append(this.generateScriptElements(jsUrls));
        docFragment.append(this.generateLinkElements(cssUrls));
        docFragment.append(this.generateMetaElements(metaInfo));

        return docFragment;
    }

    public setOnLoadCallback(docFragment: DocumentFragment, callback: () => void) {
        const scriptTags = docFragment.querySelectorAll('script');

        if (scriptTags.length === 0) {
            callback();
        } else {
            scriptTags[scriptTags.length - 1].onload = () => callback();
        }
    }

    private generateMetaElements(metaInfo: { [key: string]: string }): DocumentFragment {
        const docFragment = document.createDocumentFragment();

        Object.entries(metaInfo).forEach(([key, val]) => {
            const metaElement = document.createElement('meta');
            metaElement.setAttribute('property', key);
            metaElement.content = val;
            docFragment.appendChild(metaElement);
        });

        return docFragment;
    }

    private generateLinkElements(cssUrls: string[]): DocumentFragment {
        const docFragment = document.createDocumentFragment();

        cssUrls.forEach(url => {
            const linkElement = document.createElement('link');
            linkElement.type = 'text/css';
            linkElement.rel = 'stylesheet';
            linkElement.href = url;
            docFragment.appendChild(linkElement);
        });

        return docFragment;
    }

    private generateScriptElements(jsUrls: string[]): DocumentFragment {
        const docFragment = document.createDocumentFragment();

        jsUrls.forEach(url => {
            const scriptElement = document.createElement('script');
            scriptElement.type = 'text/javascript';
            scriptElement.src = url;
            scriptElement.async = false;
            docFragment.appendChild(scriptElement);
        });

        return docFragment;
    }

    private isMode(mode: string): boolean {
        const viaMetaProperty = this.pathUtils.getMetaPropertyValue('cq:wcmmode') === mode;
        const viaQueryParam = this.pathUtils.isBrowser() && (this.getWCMModeFromURL() === mode);

        return viaMetaProperty || viaQueryParam;
    }

    public isEditMode(): boolean {
        return this.isMode('edit');
    }

    public isPreviewMode(): boolean {
        return this.isMode('preview');
    }

    public isRemoteApp(): boolean {
        try {
            const url = new URL(this.pathUtils.getCurrentURL());
            return !!url.searchParams.get('cq:wcmmode');
        } catch (e) {
            return false;
        }
    }

    private getWCMModeFromURL(): string {
        try {
            const url = new URL(this.pathUtils.getCurrentURL());
            return url.searchParams.get('cq:wcmmode') || '';
        } catch (e) {
            return '';
        }
    }

    private prependDomain(libraries: string[]): string[] {
        const domain = this.getApiDomain();
        return libraries.map(library => `${domain || ''}${library}`);
    }

    public isInEditor(): boolean {
        return this.isEditMode() || this.isPreviewMode() || this.isRemoteApp();
    }
}
