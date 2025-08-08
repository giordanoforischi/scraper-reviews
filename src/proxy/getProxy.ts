import { ScrapingProxy } from "@lib-npm/helper";
import { BypassProxy } from "./proxies/bypass";
import { RocketScrapeProxy } from "./proxies/rocketScrape";
import { Proxy } from "./proxy";

export const getProxy = (proxy: ScrapingProxy): Proxy => {
    switch (proxy) {
        case 'RocketScrape':
            return new RocketScrapeProxy();
        case 'No proxy':
            return new BypassProxy();
    };
};