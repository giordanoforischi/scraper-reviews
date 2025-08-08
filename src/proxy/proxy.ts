import { ScrapingProxy } from "@lib-npm/helper";

export abstract class Proxy {
    abstract name: ScrapingProxy;
    abstract ignoreHTTPSErrors: boolean;

    public abstract isURLProxied(urlString: string): boolean;
    public abstract makeProxiedURL(urlString: string): URL;
};