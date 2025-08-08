import { ScrapingPayload, UnixMillis } from "@lib-npm/helper";
import { Review } from "../review/review";
import { UUIDV4 } from "@lib-npm/helper/build/schema/base";

export interface Scraper {
    scraperInstanceMillis: UnixMillis
    , scrapingConfiguration: ScrapingPayload
    , scrapeID: UUIDV4
    , getReviews(): Review[]
        , scrape(): Promise<void>
};