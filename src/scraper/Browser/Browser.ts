import { ScrapingPayload, ScrapingProvider } from "@lib-npm/helper";
import { ProviderNotImplementedError } from "../../errorHandling/error";
import { getProxy } from "../../proxy/getProxy";
import { AngiByBrowser } from "./Providers/AngiByBrowser";
import { DoctifyByBrowser } from "./Providers/DoctifyByBrowser";

export const getProviderByBrowserScraper = (provider: ScrapingProvider, scrapingConfiguration: ScrapingPayload): AngiByBrowser | DoctifyByBrowser => {
    const proxy = getProxy(scrapingConfiguration.proxy);

    switch (provider) {
        case "Angi":
            return new AngiByBrowser(scrapingConfiguration, proxy);
        case "Doctify":
            return new DoctifyByBrowser(scrapingConfiguration, proxy);
        default:
            throw new ProviderNotImplementedError(provider);
    };
};