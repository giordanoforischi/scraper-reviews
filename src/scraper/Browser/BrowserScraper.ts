import puppeteer, { Browser, ElementHandle, Page } from "puppeteer";
import { Review } from "../../review/review";
import { Proxy } from "../../proxy/proxy";
import { logHandler } from "../../errorHandling/logHandler";
import { GetPageError } from "../../errorHandling/error";
import { retry, getCurMillis, UnixMillis, ScrapingPayload, isRunningOnGCP, RetryError, LogError } from "@lib-npm/helper";
import { Scraper } from "../scraper";
import { ProxyURL } from "../../proxy/proxyURL";
import { errorWrapper } from "../../errorHandling/errorWrapper";
import { generateID } from "@lib-npm/helper/build/functions/functions";
import { UUIDV4 } from "@lib-npm/helper/build/schema/base";

export type ValidatePageLoadFunction = (page: Page) => Promise<boolean>;

export interface ProxyPage extends Page {
    proxyPageURL: ProxyURL;
};

export abstract class BrowserScraper implements Scraper {
    public proxy: Proxy;
    private ignoreHTTPSErrors: boolean;
    public scraperInstanceMillis: UnixMillis;
    protected abstract URLRegex: RegExp | null;
    protected abstract providerBaseURL: string;

    private browser?: Browser;
    public businessURL: ProxyURL;
    public scrapeID: UUIDV4;
    private reviews: Review[];

    public scrapingConfiguration: ScrapingPayload;
    private maxRetries: number;

    constructor(scrapingConfiguration: ScrapingPayload, proxy: Proxy) {
        this.scraperInstanceMillis = getCurMillis();
        this.scrapeID = generateID();
        this.scrapingConfiguration = scrapingConfiguration;
        this.proxy = proxy;
        this.businessURL = new ProxyURL(scrapingConfiguration.businessURL, this.proxy);
        this.ignoreHTTPSErrors = proxy?.ignoreHTTPSErrors || false;
        this.reviews = [];
        this.maxRetries = Number(process.env.MAX_RETRIES) || 50;
    };

    // Abstract
    protected abstract businessPageLoaded: ValidatePageLoadFunction;
    protected abstract reviewPageLoaded: ValidatePageLoadFunction;
    protected abstract hasReviews(page: Page): Promise<boolean>;
    protected abstract getPaginationArray(basePage: ProxyPage): Promise<(ProxyURL | null)[]>;
    protected abstract getReviewsFromPage(page: Page): Promise<ElementHandle[]>;
    protected abstract getDataFromReview(page: ProxyPage, reviewEl: ElementHandle): Promise<Review>;

    // Hooks
    protected validateBusinessURL(url: ProxyURL): void {
        if (this.URLRegex) {
            if (!this.URLRegex.test(url.getBaseURL().toString())) {
                throw new Error("Business URL not valid.")
            };
        };
    };

    protected cleanBusinessURL(): void { };
    protected async clearPopups(page: Page): Promise<void> { };

    // Template method
    @logHandler({ logLevel: 'Scrape', severity: 'Fatal' })
    @errorWrapper({})
    async scrape(): Promise<void> {
        // Initializes a proxy URL object and validates it
        this.validateBusinessURL(this.businessURL);
        this.cleanBusinessURL();

        // Initializes the browser
        await this.setBrowser();

        // Starts scraping and validates main business page
        const businessPage = await this.getPage(this.businessURL, this.businessPageLoaded);
        await this.clearPopups(businessPage);

        if (!await this.hasReviews(businessPage)) {
            throw new LogError({
                continueExecution: false, logAsSuccess: true, statusCode: 200
                , message: `${this.businessURL.getBaseURL().toString()} has no reviews.`
            });
        };

        // Starts iterating over review pages
        const scrapePagesURLs = (await this.getPaginationArray(businessPage)).filter(p => p !== null);
        if (!scrapePagesURLs || scrapePagesURLs.length == 0) { throw new Error('There are no review pages to scrape.'); }; // TODO error format
        for (const pageURL of (scrapePagesURLs as ProxyURL[])) { await this.scrapePage(pageURL); };

        // Closes browser
        await this.browser?.close();
    };

    @logHandler({ logLevel: 'Page', severity: 'Critical' })
    @errorWrapper({ continueExecution: true })
    async scrapePage(pageURL: ProxyURL): Promise<void> {
        const page = await this.getPage(pageURL, this.reviewPageLoaded);
        const reviewEls = await this.getReviewsFromPage(page);
        const reviews = await Promise.all(reviewEls.map(async reviewEl => {
            try {
                return await this.getDataFromReview(page, reviewEl);
            } catch (e) {
                return undefined;
            };
        }));
        const reviewsFiltered = reviews.filter(r => r !== undefined) as Review[]
        this.reviews.push(...reviewsFiltered);
    };

    // Concrete methods
    private async setBrowser(): Promise<void> {
        this.browser = await puppeteer.launch({
            headless: isRunningOnGCP()
            , defaultViewport: null
            , ignoreHTTPSErrors: this.ignoreHTTPSErrors
            , args: ['--start-maximized'
                , '--no-sandbox'
                /*                 , "--no-first-run"
                                , "--no-zygote"
                                , "--disable-gpu"
                                , "--disable-dev-shm-usage"
                                , "--disable-setuid-sandbox"
                                , "--disable-infobars"
                                , "--single-process" */
            ]
        });
    };

    private getPage = async (url: ProxyURL, pageLoadedFn: ValidatePageLoadFunction): Promise<ProxyPage> => {
        var pages = await (this.browser as Browser).pages();
        var page = pages[0];
        page.setUserAgent(process.env.CUSTOM_USER_AGENT || 'myCustomUserAgent');
        (page as ProxyPage).proxyPageURL = url;

        try {
            await retry(() => this.openPage(page, url.getProxiedURL(), pageLoadedFn), this.maxRetries);
            return (page as ProxyPage);
        } catch (e: any) {
            if (e instanceof RetryError) {
                throw new GetPageError(`Maximum retries reached on page opening.`, e?.retryErrors || []); // TODO make error array work ok
            } else {
                throw new GetPageError(`Unexpected error opening page: ${e?.message}`, []);
            };
        };
    };

    private openPage = async (page: Page, url: URL, pageLoadedFn: ValidatePageLoadFunction): Promise<void> => {
        const URLString = decodeURIComponent(url.toString());
        const response = await page.goto(URLString, { timeout: 15000 });

        if (response) {
            // 429 is RocketScrape's concurrency limit HTTP error code
            if ([429, 500].some(errorStatus => errorStatus === response.status())) {
                throw new Error(`${response.status()} error loading page.`);
            };
        } else {
            throw new Error(`Empty response from page.`);
        };

        if (!await pageLoadedFn(page)) { throw new Error('Page not loaded according to validation function.') };
    };

    //// Element handling
    public clickEl = async (elementHandle: ElementHandle) => {
        try { await elementHandle.scrollIntoView(); } catch (e) { };
        try { await elementHandle.click() }
        catch (e) {
            try { await elementHandle.evaluate(el => (el as HTMLElement).click()); }
            catch (e) { throw e; };
        };
    };

    public getElText = async (elementHandle: ElementHandle | null): Promise<string> => {
        if (elementHandle) {
            const text = await elementHandle.evaluate(el => el.textContent);
            if (text) {
                return text
            } else {
                throw new Error('No text content in element handle.')
            };
        } else {
            throw new Error('Element handle is undefined.')
        };
    };

    public getElAttribute = async (elementHandle: ElementHandle, attribute: string): Promise<string | null> => {
        return await elementHandle.evaluate((el, attribute) => el.getAttribute(attribute), attribute)
    };

    public getElHTML = async (elementHandle: ElementHandle): Promise<string | null> => {
        return await elementHandle.evaluate((element) => element.outerHTML);
    };

    public halt = async (): Promise<void> => { await new Promise(() => { }); };

    //// Other
    public appendPathToBaseURL(pathString: string): string {
        if (pathString.startsWith('/')) {
            return this.providerBaseURL + pathString;
        } else {
            throw new Error('Path string does not start with a slash.') // TODO - Add more context to error obj and http status code, maybe a custom error class from a error decorator
        };
    };

    public getReviews = (): Review[] => { return this.reviews };
};