import { Proxy } from "./proxy";

export class ProxyURL {
    private proxy: Proxy;
    private baseURL!: URL;
    private proxiedURL!: URL;

    constructor(baseURLString: string, proxy: Proxy) {
        this.proxy = proxy;
        this.setBaseURL(baseURLString);
    };

    getBaseURL(): URL { return this.baseURL; };
    getProxiedURL(): URL { return this.proxiedURL; };

    setBaseURL(baseURLString: string): void {
        if (this.proxy.isURLProxied(baseURLString)) {
            throw new Error("URL is already proxied."); // TODO - Add more context to error obj and http status code
        } else {
            this.baseURL = new URL(baseURLString);
            this.proxiedURL = new URL(this.proxy.makeProxiedURL(baseURLString));
        };
    };
};