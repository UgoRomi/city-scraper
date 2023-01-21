# City Scraper

This project uses Typescript and Puppeteer to scrape data from a public call for application web page and sends the data by email using Postmark.

## Installation

1. Clone the repository: `git clone https://github.com/YOUR_USERNAME/city-scraper.git`
2. Install the dependencies: `pnpm i`
3. Add the following environment variables:
   - `POSTMARK_KEY`: Your Postmark API key
   - `CSRF_TOKEN`: The CSRF token required to access the web page
   - `EMAIL_FROM`: The email address that the data will be sent from
   - `EMAIL_TO`: The email address that the data will be sent to
   - `MONGODB_URI`: The MongoDB connection string
   - `MONGODB_DB`: The MongoDB database name
   - `MONGODB_COLLECTION`: The MongoDB collection name
4. Run the script: `pnpm start`

## Usage

This project is intended to be run as a scheduled task (e.g. using a cron job) to automatically scrape the data and send it by email at regular intervals.
It also stores the data in a MongoDB database to avoid sending duplicate emails.

## Note

Be aware that scraping data from a website without permission may be against the website's terms of service and could potentially lead to legal consequences. Additionally, if the website does not have a public API, scraping its data may put a strain on their servers, which is not a good practice.

## Need Help

If you have any question or issues running this script please file an issue on the Github repository.
