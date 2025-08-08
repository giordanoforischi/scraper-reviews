# Review Scraper Framework

This projected intended to be a **modular framework for scraping business reviews** from different providers (e.g., Angi, Google Reviews, Yelp, etc.).  
The goal is to offer a flexible architecture where clients can choose **extraction strategies** (via browser, proxy APIs, proxy servers, data brokers, etc.) and define how and where the data is stored (e.g., BigQuery, other databases).

## ✨ Main Features (work in progress)

- **Template Method Architecture**
  - Base class `ReviewScraper` provides a standard algorithm for scraping and persistence.
  - Subclasses (e.g., `AngiScraper`) override only the necessary methods.
  
- **Multiple Extraction Strategies**
  - `ReviewsExtractStrategy` interface
  - Implementations for:
    - Data Broker
    - Proxy Server
    - Proxy APIs (e.g., RocketScrape)
  
- **Flexible Data Persistence**
  - Standard return: an array of `Review` objects
  - Supports saving to **BigQuery** or other databases passed as parameters.

- **Unified Browser Wrapper**
  - Single abstraction for different browsing models.
  - Tab control with automatic wait when the limit is reached.
  - URL rewriting when using Proxy APIs.
  - Optional configuration for anonymized proxy servers.

- **Standard Review Object**
  - Consistent format with required and optional fields.
  - Execution metadata and caller information included.

## 🛠 Example Usage

```javascript
const reviews = new AngiScraper();
const strategy = new AngiBrokerStrategy();
reviews.scrape(strategy);
```
