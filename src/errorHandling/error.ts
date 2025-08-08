import { RetryErrors, ScrapingProvider } from "@lib-npm/helper";
import { StatusCodes } from "http-status-codes";

// TODO below changed and wont work with the rest of the code, redo
export abstract class ScrapingError extends Error {
    public abstract status: StatusCodes;
    abstract name: string;
    public message: string;
    abstract suppress: boolean;

    constructor(message: string) {
        super(message);
        this.message = message;

        // Ensure the error's stack trace starts at the point where the error is created
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = (new Error(message)).stack;
        };
    };
};

export class GetPageError extends ScrapingError {
    public retryErrors: RetryErrors;
    status = 501;
    name = this.constructor.name;
    suppress = false;

    constructor(message: string, retryErrors: RetryErrors) { 
        super(message); 
        this.retryErrors = retryErrors;
    };
};

export class NoReviewsError extends ScrapingError {
    name = this.constructor.name;
    status = 200;
    suppress = true; // This won't be counted as an error and won't break the application.
    constructor(businessURL: string) { super(`${businessURL} has no reviews.`); };
};

export class ProviderNotImplementedError extends ScrapingError {
    name = this.constructor.name;
    status = 501;
    suppress = false;
    constructor(provider: ScrapingProvider) { super(`${provider} not implemented.`); };
};

export class InvalidBusinessURLError extends ScrapingError {
    name = this.constructor.name;
    status = 400;
    suppress= false;
    constructor(businessURL: URL) { super(`${businessURL.toString()} is an invalid business URL.`); };
};