import { LogError, ReviewData, ReviewFullData, ScrapingPayload, UnixMillis, getEnv, reviewSchema } from "@lib-npm/helper";
import { UUIDV4 } from "@lib-npm/helper/build/schema/base";
import { ZodType } from "zod";

export class Review {
    private data: ReviewFullData;
    private zodValidation: ZodType;
    private scrapingConfiguration: ScrapingPayload;
    private scraperInstanceMillis: UnixMillis;
    private scrapeID: UUIDV4;
    
    constructor(scrapingConfiguration: ScrapingPayload, scraperInstanceMillis: UnixMillis, scrapeID: UUIDV4) {
        this.data = {} as ReviewFullData;
        this.scraperInstanceMillis = scraperInstanceMillis;
        this.zodValidation = reviewSchema;
        this.scrapingConfiguration = scrapingConfiguration;
        this.scrapeID = scrapeID;
        this.setRuntimeMetadata();
    };

    public loadAndVerify(data: ReviewData): void {
        this.loadData(data);
        this.setRuntimeMetadata();
        this.checkIfValid();
    };

    private loadData(data: ReviewData): void {
        this.data = { ...this.data, ...data };
    };

    private setRuntimeMetadata(): void {
        const data = {
            env: getEnv()
            , mode: this.scrapingConfiguration.mode
            , proxy: this.scrapingConfiguration.proxy
            , scraperInstanceMillis: this.scraperInstanceMillis
            , addedToQueueMillis: this.scrapingConfiguration.addedToQueueMillis
            , scrapeID: this.scrapeID
        };

        this.data = { ...this.data, runtimeMetadata: data };
    };

    private checkIfValid(): boolean {
        try {
            this.zodValidation.parse(this.data);
            return true;
        } catch (error) {
            throw new LogError({ continueExecution: false, message: `Review payload not valid or incomplete. ${error}`, name: 'Review data invalid.' });
            // TODO add some field with detailing of invalid data fields here
        };
    };

    public getData(): any {
        try {
            this.checkIfValid();
            return this.data
        } catch (e) {
            throw e
        };
    };
};