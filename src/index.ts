import { Request, Response } from "express";
import { HttpFunction } from '@google-cloud/functions-framework';
import { ScrapingClient } from "./client/ScrapingClient";
import { scraperPayloadSchema, reviewTableSchema, insertToBQ, getEnv } from "@lib-npm/helper";
import { getBunyanLogger } from "@lib-npm/helper/build/services/bunyan";

require('dotenv').config();

export const main: HttpFunction = async (req: Request, res: Response) => {
  try {
    const GCP_REVIEWS_DATASET_ID = process.env.GCP_REVIEWS_DATASET_ID;
    const GCP_REVIEWS_TABLE_ID = process.env.GCP_REVIEWS_TABLE_ID;

    try {
      var payloadData = scraperPayloadSchema.parse(req.body);
    } catch (e: any) {
      throw new Error(`Payload not valid. ${e.message}`)
    };

    const client = new ScrapingClient(payloadData);
    const { returnReviews, persistReviews } = payloadData;

    const reviews = await client.getReviews();
    if (persistReviews && reviews.length > 0) {
      await insertToBQ((GCP_REVIEWS_DATASET_ID as string), (GCP_REVIEWS_TABLE_ID as string), reviews, reviewTableSchema, true);
    }
    // TODO change all many-params fn call to obj with names
    res.status(200).send(returnReviews ? reviews : undefined);

  } catch (e: any) {
    if (getEnv() === 'DEV') { throw e; };
    res.status(e?.logErrorParams?.statusCode || 501).send(e?.logErrorParams?.message || 'Unexpected error.');
  };
};

export const logger = getBunyanLogger((process.env.GCP_PROJECT_ID as string), (process.env.GCP_LOG_NAME as string));