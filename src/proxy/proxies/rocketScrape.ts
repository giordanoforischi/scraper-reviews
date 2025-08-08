import { ScrapingProxy } from "@lib-npm/helper";
import { Proxy } from "../proxy";

export class RocketScrapeProxy extends Proxy {
    public name: ScrapingProxy = 'RocketScrape';
    public ignoreHTTPSErrors = true;

    getBaseURLString(): string {
        const apiKey = process.env.ROCKET_SCRAPE_API_KEY;
        const render = false;
        return `https://api.rocketscrape.com/?apiKey=${apiKey}&render=${render}`;
    };

    isURLProxied(urlString: string): boolean {
        const url = new URL(urlString);
        return ['apiKey', 'url'].every(param => url.searchParams.has(param));
    };

    makeProxiedURL(urlString: string): URL {
        const url = new URL(this.getBaseURLString());
        url.searchParams.set('url', urlString);
        return url;
    };
};
