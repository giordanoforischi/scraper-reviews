import { LogAlert, LogStatus, UUIDV4 } from "@lib-npm/helper/build/schema/base";
import { logger } from "..";
import { Scraper } from "../scraper/scraper";
import { Log, ScrapingPayload, getCurMillis, getEnv, LogLevel, LogSeverity, LogError, RetryErrors } from "@lib-npm/helper";

type LogParams = {
    logLevel: LogLevel
    , severity: LogSeverity
};

export function logHandler(logHandlerParams: LogParams, logSuccess: boolean = true) {
    return function logHandlerSub(value: any, context: any): any {
        if (!value) {
            throw new Error(`Function ${context.name} can't be accessed by the decorator. 
            This might've happened if it was declared as an arrow function.`);
        };

        return async function (this: Scraper, ...args: any[]) {
            const scrapingConfiguration = this.scrapingConfiguration;
            const scrapeID = this.scrapeID;
            var startTimeMillis = Date.now(); // Starts counting the execution time

            try {
                // Runs function
                const response = await value.call(this, ...args);
                const executionTime: number = Date.now() - startTimeMillis;

                // In case of success, call the log creation function with the success data
                logSuccess && createLog(scrapingConfiguration, scrapeID, executionTime, logHandlerParams, `Success on ${logHandlerParams.logLevel}`, 'Success', { alertByMail: false });
                return response;

            } catch (error: any) {
                const executionTime: number = Date.now() - startTimeMillis;

                if (error instanceof LogError) { // Error wrapped functions will create a standard error type

                    const errorParams = error.logErrorParams;

                    if (!errorParams.suppressLog) {
                        createLog(scrapingConfiguration
                            , scrapeID
                            , executionTime
                            , logHandlerParams
                            , errorParams.message!
                            , errorParams.logAsSuccess ? 'Success' : 'Failure'
                            , errorParams.alert!
                            , errorParams.retryErrors);
                    };

                    if (errorParams.continueExecution) {
                        return;
                    } else {
                        await (this as any)?.browser?.close();
                        throw error;
                    };

                } else {
                    // If it's not an error wrapped function that throws a standard LogError, creates a log with the error message
                    await (this as any)?.browser?.close();
                    const e = new LogError({
                        statusCode: 501, message: error.message ? error.message : 'Unexpected error.'
                        , retryErrors: error.retryErrors ? error.retryErrors : []
                    });
                    createLog(scrapingConfiguration
                        , scrapeID
                        , executionTime
                        , logHandlerParams
                        , e.logErrorParams.message!
                        , 'Failure'
                        , { alertByMail: false }
                        , e.logErrorParams.retryErrors);
                    throw e
                };
            };
        };
    };
};

const createLog = (scrapingConfiguration: ScrapingPayload
    , scrapeID: UUIDV4
    , executionTime: number
    , logHandlerParams: LogParams
    , message: string
    , status: LogStatus
    , alert: LogAlert
    , retryErrors?: RetryErrors) => {

    const log: Log = {
        cloudResource: 'Cloud Function'
        , application: 'Scraper'
        , env: getEnv()
        , instanceID: scrapeID
        , timestampMillis: getCurMillis()
        , applicationLevel: logHandlerParams.logLevel
        , message: message
        , executionTime: executionTime
        , severity: logHandlerParams.severity
        , status: status
        , alert: alert
        , detailsType: 'ScraperPayload'
        , details: scrapingConfiguration
        , retryErrors: retryErrors ? retryErrors : []
    };

    if (status == 'Success') {
        logger.info(log);
    } else {
        switch (logHandlerParams.severity) {
            case 'Fatal':
                logger.fatal(log);
                break;
            case 'Critical':
                logger.error(log);
                break;
            case 'Nonblocking':
                logger.warn(log);
                break;
            case 'Info':
                logger.info(log);
                break;
            case 'Debug':
                logger.debug(log);
                break;
            default:
                logger.error(log);
                break;
        };
    };
};