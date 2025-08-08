import puppeteer from "puppeteer";
import proxyChain from "proxy-chain";

export const proxyApiConfigs = [
    {
        name: "ScraperApi"
        , username: 'USERNAME'  // Replace with your ScraperAPI username
        , password: 'PASSWORD'  // Replace with your ScraperAPI password
        , url: 'proxy-server.scraperapi.com'
        , port: '8001'
    }
    , {
        name: "ZenRows"
        , username: 'USERNAME' // Replace with your ZenRows username
        , password: 'PASSWORD'  // Replace with your ZenRows password
        , url: 'proxy.zenrows.com'
        , port: '8001'
    }
    , {
        name: "ScrapingBee"
        , username: 'USERNAME' // Replace with your ScrapingBee username
        , password: 'block_resources=false'
        , url: 'proxy.scrapingbee.com'
        , port: '8886'
    }
    , {
        name: "ScrapingDog"
        , username: 'scrapingdog' // .country_code=us.device_type=desktop
        , password: 'PASSWORD' // Replace with your ScrapingDog password
        , url: 'proxy.scrapingdog.com'
        , port: '8081'
    }
    , {
        name: 'ProxyScrape'
        , url: 'URL' // Replace with your ProxyScrape URL
    }

];

export const getAnonymizedProxyUrl = async (proxyApiConfig) => {
    const { username, password, url, port } = proxyApiConfig;

    console.log('Anonymizing proxy...')
    const oldProxyUrl = `http://${username}:${password}@${url}:${port}`;
    return await proxyChain.anonymizeProxy(oldProxyUrl);
};

export const getBrowserPage = async (anonymizedProxyUrl = null, proxyServerUrl = null) => {
    const args = ['--start-maximized'];

    if (anonymizedProxyUrl) {
        args.push(`--proxy-server=${anonymizedProxyUrl}`)
    };

    if (proxyServerUrl) {
        args.push(`--proxy-server=${proxyServerUrl}`)
    };

    const browser = await puppeteer.launch({
        headless: Boolean(process.env.HEADLESS || process.env.NODE_ENV)
        , defaultViewport: null, args: args, ignoreHTTPSErrors: Boolean(anonymizedProxyUrl || proxyServerUrl)
    });

    const pages = await browser.pages();
    const page = pages[0];

    return page;
};