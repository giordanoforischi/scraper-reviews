import { ElementHandle, Page } from "puppeteer";
import { Review } from "../../../review/review";
import { BrowserScraper, ProxyPage, ValidatePageLoadFunction } from "../BrowserScraper";
import { URL } from "url";
import { Proxy } from "../../../proxy/proxy";
import { logHandler } from "../../../errorHandling/logHandler";
import { InvalidBusinessURLError } from "../../../errorHandling/error";
import { KeyValueField, ReviewBusiness, ReviewChecksum, ReviewContent, ReviewData, ReviewMetadata, ReviewReply, ReviewReviewer, ScrapingPayload, ScrapingProvider, dateToUnixMillis, hashString } from "@lib-npm/helper";
import { ProxyURL } from "../../../proxy/proxyURL";
import { errorWrapper } from "../../../errorHandling/errorWrapper";

export class DoctifyByBrowser extends BrowserScraper {
    public providerBaseURL: string = 'https://www.doctify.com';
    private provider: ScrapingProvider = 'Doctify';
    protected URLRegex = null;

    constructor(scrapingConfiguration: ScrapingPayload, proxy: Proxy) {
        super(scrapingConfiguration, proxy);
    };

    // Required methods
    protected businessPageLoaded: ValidatePageLoadFunction = async (page: Page) => {
        const reviews = await page.$$("::-p-xpath(//h2[contains(text(), 'Reviews')])");
        return !!reviews;
    };
    protected reviewPageLoaded: ValidatePageLoadFunction = this.businessPageLoaded;

    protected async hasReviews(page: Page): Promise<boolean> {
        const emptyReviewsWarning = await page.$("::-p-xpath(//p[contains(text(), ' is not actively collecting reviews right now')])");
        const emptyReviewsWarning2 = await page.$("::-p-xpath(//p[contains(text(), ' has not collected any reviews yet')])");
        return !emptyReviewsWarning && !emptyReviewsWarning2;
    };

    async getPaginationArray(basePage: ProxyPage): Promise<(ProxyURL | null)[]> {
        await basePage.$("::-p-xpath(//p[contains(text(), ' reviews')]/b[1])")

        const reviewsQtt = await this.getElText(await basePage.$("::-p-xpath(//p[contains(text(), ' reviews')]/b[1])"));
        const maxPage = Math.ceil(Number(reviewsQtt) / 10)
        const pagesArray = Array(maxPage)
            .fill(1)
            .map((a, index) => {
                const urlString = `${basePage.proxyPageURL.getBaseURL().toString()}/reviews/page-${index + 1}`;
                return new ProxyURL(urlString, this.proxy);
            });
        return pagesArray;
    };

    async getReviewsFromPage(page: Page): Promise<ElementHandle[]> {
        const selector = "::-p-xpath(//p[contains(text(), ' reviews')]/ancestor::*[6]/div[contains(@class,'MuiPaper-root')])"
        await page.waitForSelector(selector, { timeout: 5000 });
        return await page.$$(selector);
    };

    @logHandler({ logLevel: 'Review', severity: 'Critical' })
    @errorWrapper({ continueExecution: true })
    async getDataFromReview(page: ProxyPage, reviewEl: ElementHandle): Promise<Review> {
        // Get data
        const tagElements = await reviewEl.$$('::-p-xpath(div[2]/div[1]/div[1]/div[1]/div)');
        const tags = await Promise.all(tagElements.map(async tagEl => await this.getTagFromEl(tagEl)));

        const stars = Number(await (this.getElText(await reviewEl.$('::-p-xpath(div[1]/p[1])'))));

        const content = await reviewEl.$('::-p-xpath(div[3])');

        const originalText = await this.getElText(await (content as ElementHandle).$('::-p-xpath(p[1])'));
        const reviewDate = new Date(await this.getElText(await (content as ElementHandle).$('::-p-xpath(div[1]/span[1])')));
        const seenForEls = await (content as ElementHandle).$$('::-p-xpath(div[2]/div)');
        const seenFor = await Promise.all(seenForEls.map(async el => await this.getSeenForFromEl(el)));

        // Set data
        const reviewContent: ReviewContent = { originalText, stars, seenFor: seenFor, postedUnixMillis: dateToUnixMillis(reviewDate), tags };
        const reviewer: ReviewReviewer = { name: '(not provided)', verified: true };
        const reply: ReviewReply = { hasReply: false };

        const reviewMetadata: ReviewMetadata = {
            baseURL: page.proxyPageURL.getBaseURL().toString()
            , proxiedURL: page.proxyPageURL.getProxiedURL().toString(), provider: this.provider
        }
        const business: ReviewBusiness = { id: this.businessURL.getBaseURL().toString() };
        const checksum: ReviewChecksum = hashString(originalText) + '_' + dateToUnixMillis(reviewDate);

        const reviewData: ReviewData = { reviewer, reviewMetadata, reviewContent, reply, business, checksum };

        // Make review object
        const review = new Review(this.scrapingConfiguration, this.scraperInstanceMillis, this.scrapeID);
        review.loadAndVerify(reviewData);
        return review;
    };

    // Hooks
    protected cleanBusinessURL(): void {
        if (this.businessURL.getBaseURL().toString().includes('/reviews')) {
            throw new InvalidBusinessURLError(this.businessURL.getBaseURL());
        };

        var baseURL = this.businessURL.getBaseURL();
        baseURL.search = '';
        const removedEndSlashURLString = baseURL.toString().endsWith('/') ? baseURL.toString().slice(0, -1) : baseURL.toString()
        baseURL = new URL(removedEndSlashURLString);
        this.businessURL.setBaseURL(baseURL.toString());
    };

    @logHandler({ logLevel: 'Scrape', severity: 'Nonblocking' })
    @errorWrapper({ continueExecution: true })
    async clearPopups(page: Page): Promise<void> {
        const selector = "::-p-xpath(//span[contains(text(), 'AGREE')])"
        await page.waitForSelector(selector, { timeout: 5000 });
        const cookieAgreeBtn = await page.$(selector);
        await this.clickEl((cookieAgreeBtn as ElementHandle));
    };

    // Auxiliary
    private getTagFromEl = async (elementHandle: ElementHandle | null): Promise<KeyValueField> => {
        if (elementHandle) {
            const key = (await this.getElText(await elementHandle.$('::-p-xpath(div[2]/span[1])'))).toLocaleLowerCase();
            const value = await this.getElText(await elementHandle.$('::-p-xpath(div[1]/span[1])'));
            return { key, value: Number(value) };
        } else {
            throw new Error('Element handle is undefined.');
        };
    };

    private getSeenForFromEl = async (elementHandle: ElementHandle): Promise<string> => {
        return await this.getElText(await elementHandle.$('::-p-xpath(span[1]/div[1]/span[1])'));
    };
};