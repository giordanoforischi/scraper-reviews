import { LogError, LogErrorParams, logErrorParamsSchema } from "@lib-npm/helper";
import { Scraper } from "../scraper/scraper";

export function errorWrapper(logErrorParams: LogErrorParams) {
    return function erroWrapperSub(value: any, context: any): any {
        if (!value) {
            throw new Error(`Function ${context.name} can't be accessed by the decorator. 
            This might've happened if it was declared as an arrow function.`);
        };

        return async function (this: Scraper, ...args: any[]) {
            try {
                const response = await value.call(this, ...args);
                return response;
            } catch (error: any) {
                if (error instanceof LogError) {
                    throw error
                } else {
                    const parsedLogErrorParams = logErrorParamsSchema.parse(logErrorParams);
                    throw new LogError({
                        ...parsedLogErrorParams
                        , message: logErrorParams.message ? logErrorParams.message : error.message
                        , stackTrace: logErrorParams.stackTrace ? logErrorParams.stackTrace : error.stack
                        , retryErrors: logErrorParams?.retryErrors ? logErrorParams.retryErrors : []
                    })
                };
            };
        };
    };
};