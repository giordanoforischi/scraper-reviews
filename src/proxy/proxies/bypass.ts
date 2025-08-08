import { ScrapingProxy } from "@lib-npm/helper";
import { Proxy } from "../proxy";

export class BypassProxy extends Proxy {
    public name: ScrapingProxy = 'No proxy';
    public ignoreHTTPSErrors = false;
    
    isURLProxied(urlString: string): boolean { return false };
    makeProxiedURL(urlString: string): URL { return new URL(urlString); };
};