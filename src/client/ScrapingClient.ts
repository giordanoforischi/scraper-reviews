import { ScrapingPayload } from "@lib-npm/helper";
import { Review } from "../review/review";
import { getProviderByBrowserScraper } from "../scraper/Browser/Browser";
import { Scraper } from "../scraper/scraper";

export class ScrapingClient {
    private scraper: Scraper;
    public scrapingConfiguration: ScrapingPayload;

    constructor(scrapingConfiguration: ScrapingPayload) {
        this.scrapingConfiguration = scrapingConfiguration;
        this.scraper = getProviderByBrowserScraper(scrapingConfiguration.provider, scrapingConfiguration);
    };

    public getReviews = async (): Promise<Review[]> => {
        await this.scraper.scrape();
        const reviews = this.scraper.getReviews();
        return reviews.map(r => r.getData());
    };
};