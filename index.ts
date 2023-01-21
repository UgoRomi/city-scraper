import puppeteer from "puppeteer";
import * as dotenv from "dotenv";
import { ServerClient } from "postmark";
import { parse } from "url";
import { MongoClient, ServerApiVersion } from "mongodb";

dotenv.config();

function isLink(
  link: { href: string; title: string } | null
): link is { href: string; title: string } {
  return link !== null;
}

const createPlainTextEmail = (links: { href: string; title: string }[]) => {
  let text = "";
  links.forEach(({ href, title }) => {
    text += `- ${title}: ${href}\n`;
  });
  return text;
};

const createHtmlEmail = (links: { href: string; title: string }[]) => {
  let list = "<ul>";
  links.forEach(({ href, title }) => {
    list += `<li><a href="${href}">${title}</a></li>`;
  });
  list += "</ul>";
  return list;
};

const sendEmail = async (links: { href: string; title: string }[]) => {
  const client = new ServerClient(process.env.POSTMARK_KEY as string);

  const result = await client.sendEmail({
    From: process.env.EMAIL_FROM as string,
    To: process.env.EMAIL_TO as string,
    Subject: "Nuovi bandi di concorso",
    HtmlBody:
      "<h1>Ecco i nuovi bandi di concorso</h1>\n" + createHtmlEmail(links),
    TextBody: "Ecco i nuovi bandi di concorso \n" + createPlainTextEmail(links),
    MessageStream: "outbound",
  });
  if (result.ErrorCode) {
    console.error(result);
  } else {
    console.log("Email sent");
  }
};

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(
    `https://servizi.comune.siena.it/openweb/pratiche/registri.php?sezione=concorsi&CSRF=${process.env.CSRF_TOKEN}}`
  );

  // Find the button to filter only for the active calls for applications
  const filterButton = await page.waitForSelector("text/Bandi Attivi");
  if (filterButton) await filterButton.click();

  const tableSelector = "#table_delibere > li:not(.table-header)";
  await page.waitForSelector(tableSelector);
  const callsForApplicationsFound: Array<{ href: string; title: string }> = [];
  // Extract the results from the page.
  do {
    callsForApplicationsFound.push(
      ...(await page.evaluate((tableSelector) => {
        return [...document.querySelectorAll(tableSelector)]
          .filter((element) => {
            const match = /infanzia|asilo|nido|educatrice|educatore/i;
            return match.test(element.textContent || "");
          })
          .map((element) => {
            const aTags = Array.from(element.querySelectorAll("a"));
            const aTag = aTags.filter(
              (a) => a.textContent?.trim() === "Dettagli bando"
            )[0];
            return {
              href: aTag.getAttribute("href") || "",
              title: element.textContent || "Bando senza titolo",
            };
          });
      }, tableSelector))
    );
    // Get the next button and click it if it exists
    const button = await page.$("button[title='Successiva']");
    if (button) await button.click();
  } while (await page.$("button[title='Successiva']"));

  if (callsForApplicationsFound.length > 0) {
    const client = new MongoClient(process.env.MONGODB_URI as string, {
      serverApi: ServerApiVersion.v1,
    });
    try {
      // Connect to the MongoDB cluster
      await client.connect();
      const collection = client
        .db(process.env.MONGODB_DB as string)
        .collection<{ link: string; id: string }>(
          process.env.MONGODB_COLLECTION as string
        );

      // Get all calls for applications already sent
      const callsForApplicationsAlreadySent = (
        await collection.find({}).toArray()
      ).map((document) => document.id);

      // Filter out calls for applications already sent
      const newCallsForApplication = callsForApplicationsFound.filter(
        (link) => {
          const parsedURL = parse(link.href, true);
          const id = parsedURL.query.id as string;
          return !callsForApplicationsAlreadySent.includes(id);
        }
      );

      if (newCallsForApplication.length > 0) {
        // send the email
        await sendEmail(newCallsForApplication);

        // add the new calls for application to the database
        await collection.insertMany(
          newCallsForApplication.map((link) => {
            const parsedURL = parse(link.href, true);
            const id = parsedURL.query.id as string;
            return { link: link.href, id };
          })
        );
      }
    } catch (e) {
      // If an error occurs, log it and send an email anyway
      console.error(e);
      await sendEmail(callsForApplicationsFound);
    } finally {
      await client.close();
    }
  }

  await browser.close();
})();
