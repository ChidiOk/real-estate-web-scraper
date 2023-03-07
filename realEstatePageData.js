import puppeteer from "puppeteer";
import fs from "fs";

(async () => {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();

	await page.setDefaultNavigationTimeout(120000);

	const url =
		"http://www.corcoran.com/search/for-sale/location/northwest-harris-tx-17534130/regionId/119/";

	try {
		const response = await page.goto(url);
		console.log(response.status());

		const lastPageSelector = ".Paginator__FirstOrLastPage-sc-44618f2a-6";
		const listingSelector = '[data-e2e-id="listing-card__top-section-link"]';
		const nextButtonSelector = 'button[data-e2e-id="paginator__button"]';

		const lastPageElement = await page.$(lastPageSelector);
		const lastPageInnerHtml = await lastPageElement.evaluate(
			(el) => el.innerHTML
		);
		const lastPageInt = parseInt(lastPageInnerHtml);

		const listingResults = [];
		let pageNumber = 0;

		while (pageNumber < lastPageInt) {
			const listingElements = await page.$$(listingSelector);
			const listingUrls = await Promise.all(
				listingElements.map(async (element) => {
					return await element.evaluate((el) => el.href);
				})
			);

			const listingDataPromises = listingUrls.map(async (url) => {
				const listingPage = await browser.newPage();

				try {
					await listingPage.goto(url);
				} catch (error) {
					console.error(`Error navigating to ${url}: ${error}`);
				}

				const listingData = await listingPage.evaluate(() => {
					const getBathCount = (bathStr) => {
						const bathRegex = /(\d+)\s+baths(?:\/(\d+)\s+half bath)?/;
						const bathMatches = bathStr.match(bathRegex);

						let bathCount = 0;
						if (bathMatches) {
							const fullBaths = parseInt(bathMatches[1]);
							const halfBaths = bathMatches[2] ? bathMatches[2] / 10 : 0;
							bathCount = fullBaths + halfBaths;
						}
						return bathCount ? bathCount.toFixed(1) : "";
					};

					const streetElement = document.querySelector(
						'h1[data-e2e-id="main-listing-info__listing-title"]'
					);
					const street = streetElement ? streetElement.innerText.trim() : null;
					const cityElement = document.querySelector("#neighborhood-name-link");
					const city = cityElement
						? cityElement.innerText.replace(/,\s*$/, "")
						: null;
					const priceElement = document.querySelector(
						".TextBase-sc-3b1caa46-0"
					);
					const price = priceElement ? priceElement.innerHTML : null;
					const bedElement = document.querySelector(
						'div[data-e2e-id="main-listing-info__flex-container__bedroom-info"]'
					);
					const bed = bedElement
						? parseInt(bedElement.textContent.match(/\d+/)[0])
						: null;
					const bathElement = document.querySelector(
						'div[data-e2e-id="main-listing-info__flex-container__bathrooms"]'
					);
					const bath = bathElement
						? getBathCount(bathElement.textContent.trim())
						: null;
					const brokerageElement = document.querySelector(
						".MainListingInfo__CompensationTextWrapper-sc-d88565d5-18"
					);
					const brokerageFee = brokerageElement
						? brokerageElement.textContent.match(/\d+\.*\d*\%/g)[0]
						: null;

					const annualTaxElement = document.querySelector(
						'[data-e2e-id="main-listing-info__tax"]'
					);
					const annualTax = annualTaxElement
						? `$${annualTaxElement.innerText.split("$")[1]}`
						: null;
					const sqftElement = document.querySelector(
						'[data-e2e-id="main-listing-info__flex-container__squarefootage"]'
					);
					const sqft = sqftElement
						? parseInt(sqftElement.textContent.trim().match(/\d+/)[0])
						: null;

					return {
						street,
						city,
						price,
						bed,
						bath,
						brokerageFee,
						annualTax,
						sqft,
					};
				});

				console.log(listingData);
				await listingPage.close();
				return listingData;
			});

			const pageListingData = await Promise.all(listingDataPromises);
			listingResults.push(...pageListingData.flatMap((data) => data));

			console.log(
				`Completed page ${pageNumber + 1} of ${lastPageInt}`,
				listingResults.length
			);

			await page.evaluate((nextButtonSelector) => {
				const nextButton = document.querySelector(nextButtonSelector);
				nextButton.click();
			}, nextButtonSelector);

			pageNumber++;
		}

		//write to file
		fs.writeFileSync(
			"listingResults1.txt",
			JSON.stringify(listingResults),
			"utf-8"
		);
		console.log("Results saved to file.");

		await browser.close();
	} catch (error) {
		console.log(error);
	}
})();
