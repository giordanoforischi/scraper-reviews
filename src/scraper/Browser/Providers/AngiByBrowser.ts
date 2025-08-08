import { ElementHandle, Page } from "puppeteer";
import { Review } from "../../../review/review";
import { BrowserScraper, ProxyPage, ValidatePageLoadFunction } from "../BrowserScraper";
import { Proxy } from "../../../proxy/proxy";
import { getProxy } from "../../../proxy/getProxy";
import { logHandler } from "../../../errorHandling/logHandler";
import { hashString, KeyValueField, ReviewBusiness, ReviewChecksum, ReviewContent, ReviewData, ReviewMetadata, ReviewReply, ReviewReviewer, ScrapingPayload, ScrapingProvider, dateToUnixMillis } from "@lib-npm/helper";
import { ProxyURL } from "../../../proxy/proxyURL";
import { errorWrapper } from "../../../errorHandling/errorWrapper";

export class AngiByBrowser extends BrowserScraper {
    public providerBaseURL: string = 'https://www.angi.com';
    private provider: ScrapingProvider = 'Angi';
    protected URLRegex = null;

    constructor(scrapingConfiguration: ScrapingPayload, proxy: Proxy) {
        super(scrapingConfiguration, proxy);
        this.proxy = getProxy('No proxy'); // Overrides proxy because Angi doesn't work on proxy. Eventually this might need to validated agains provider vs. proxies configuration.
    };

    // Required methods
    protected businessPageLoaded: ValidatePageLoadFunction = async (page: Page) => {
        const reviewsSection = await page.$("::-p-xpath(//div[@id='reviews-section'])");
        return !!reviewsSection;
    };
    protected reviewPageLoaded: ValidatePageLoadFunction = this.businessPageLoaded;

    protected async hasReviews(page: Page): Promise<boolean> {
        const reviewsSection = await page.$("::-p-xpath(//div[@id='reviews-section'])");
        const reviewsContainer = await (reviewsSection as ElementHandle).$("::-p-xpath(//div[@id='reviews'])");
        return !!reviewsContainer;
    };

    async getPaginationArray(basePage: ProxyPage): Promise<(ProxyURL | null)[]> {
        const reviewsSection = await basePage.$("::-p-xpath(//div[@id='reviews-section'])");
        if (reviewsSection) {
            const paginationOptions = await reviewsSection.$$("::-p-xpath(ul/ul/li[not(@class = 'next')][not(@class = 'active')])");
            var pages = await Promise.all(paginationOptions.map(async (p, index): Promise<ProxyURL | null> => {
                const el = await p.$("::-p-xpath(a)");
                const urlPathString = await this.getElAttribute((el as ElementHandle), 'href');
                if (urlPathString) {
                    const fullURLString = this.appendPathToBaseURL(urlPathString);
                    const url = new ProxyURL(fullURLString, this.proxy);
                    return this.fixAngiPageURL(url, index + 2);
                } else {
                    throw new Error('No URL found in pagination element.')
                };
            }));
            return [basePage.proxyPageURL, ...pages];
        } else {
            throw new Error('Pagination container element not found');
        };
    };

    async getReviewsFromPage(page: Page): Promise<ElementHandle[]> {
        const reviewsSection = await page.$("::-p-xpath(//div[@id='reviews-section'])");
        const reviewsContainer = await (reviewsSection as ElementHandle).$("::-p-xpath(//div[@id='reviews'])");
        return await (reviewsContainer as ElementHandle).$$('::-p-xpath(div)');
    };

    @logHandler({ logLevel: 'Review', severity: 'Critical' })
    @errorWrapper({ continueExecution: true })
    async getDataFromReview(page: ProxyPage, reviewEl: ElementHandle): Promise<Review> {
        // Get data
        const expandBtn = await reviewEl.$('::-p-xpath(button)');
        await this.clickEl((expandBtn as ElementHandle));

        const userName = await this.getElText(await reviewEl.$('::-p-xpath(div[1]/div[1]/span)'));

        const originalText = await this.getElText(await reviewEl.$('::-p-xpath(div[2]/div[2])'));
        const reviewDate = new Date(this.formatAngiDateString(await this.getElText(await reviewEl.$('::-p-xpath(div[1]/div[1]/div[1])'))));
        const stars = Number(await (this.getElText(await reviewEl.$('::-p-xpath(div[1]/div[2]/span)'))));
        const lineOfWork = await this.getElText(await reviewEl.$('::-p-xpath(div[2]/div[1]/div[1]/span)'));

        const tagElements = await reviewEl.$$('::-p-xpath(div[3]/div[1]/table[1]/tbody[1]/tr)');
        const tags = await Promise.all(tagElements.map(async tagEl => await this.getTagFromRow(tagEl)));

        const verified = true

        // Set data
        const reviewContent: ReviewContent = { originalText, stars, seenFor: this.splitLineOfWork(lineOfWork), postedUnixMillis: dateToUnixMillis(reviewDate), tags };
        const reviewer: ReviewReviewer = { name: userName, verified };
        const reply: ReviewReply = { hasReply: false };
        const reviewMetadata: ReviewMetadata = {
            baseURL: page.proxyPageURL.getBaseURL().toString(),
            proxiedURL: page.proxyPageURL.getProxiedURL().toString(), provider: this.provider
        }
        const business: ReviewBusiness = { id: this.businessURL.getBaseURL().toString() };
        const checksum: ReviewChecksum = hashString(userName) + '_' + dateToUnixMillis(reviewDate);

        const reviewData: ReviewData = { reviewer, reviewMetadata, reviewContent, reply, business, checksum };

        // Make review object
        const review = new Review(this.scrapingConfiguration, this.scraperInstanceMillis, this.scrapeID);
        review.loadAndVerify(reviewData);
        return review;
    };

    // Other
    private formatAngiDateString = (inputString: string) => {
        const [month, year] = inputString.split('/');
        return `${year}-${month}-01`; // MM/YYYY to YYYY-MM-DD
    };

    // Hooks
    protected cleanBusinessURL(): void {
        const baseURL = this.businessURL.getBaseURL();
        baseURL.search = '';
        this.businessURL.setBaseURL(baseURL.toString());
    };

    // Auxiliary
    private fixAngiPageURL = (url: ProxyURL, index: number): ProxyURL => {
        const baseURL = url.getBaseURL();
        baseURL.searchParams.set('page', index.toString());
        baseURL.searchParams.set('featuredReviewsLimit', '25');
        baseURL.searchParams.set('featuredReviewsOffset', ((index - 1) * 25).toString());
        url.setBaseURL(baseURL.toString());
        return url;
    };

    private getTagFromRow = async (elementHandle: ElementHandle | null): Promise<KeyValueField> => {
        if (elementHandle) {
            const key = await this.getElText(await elementHandle.$('::-p-xpath(td[1])'));
            const value = Number(await this.getElText(await elementHandle.$('::-p-xpath(td[2]/div[1]/span[1])')));
            return { key, value };
        } else {
            throw new Error('Element handle is undefined.');
        };
    };

    private splitLineOfWork = (str: string) => {
        return str.split(/\s* or \s*|\s*,\s*/).map(s => s.trim().toLowerCase());
    };
};