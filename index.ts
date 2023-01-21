import puppeteer from "puppeteer";
import * as dotenv from "dotenv";
import { ServerClient } from "postmark";

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

dotenv.config();
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(
    `https://servizi.comune.siena.it/openweb/pratiche/registri.php?sezione=concorsi&CSRF=${process.env.CSRF_TOKEN}}`
  );

  const filterButton = await page.waitForSelector("text/Bandi Attivi");
  if (filterButton) await filterButton.click();

  // Wait for suggest overlay to appear and click "show all results".
  const tableSelector = "#table_delibere > li:not(.table-header)";
  await page.waitForSelector(tableSelector);
  const links: Array<{ href: string; title: string } | null> = [];
  // Extract the results from the page.
  do {
    links.push(
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
    const button = await page.$("button[title='Successiva']");
    if (button) await button.click();
  } while (await page.$("button[title='Successiva']"));

  // Print all the files.
  const workingLinks = links.filter(isLink);
  console.log(`Found ${workingLinks.length} new links`);
  if (workingLinks.length > 0) {
    const client = new ServerClient(process.env.POSTMARK_KEY as string);

    const result = await client.sendEmail({
      From: process.env.EMAIL_FROM as string,
      To: process.env.EMAIL_TO as string,
      Subject: "Nuovi bandi di concorso",
      HtmlBody:
        "<h1>Ecco i nuovi bandi di concorso</h1>\n" +
        createHtmlEmail(workingLinks),
      TextBody:
        "Ecco i nuovi bandi di concorso \n" +
        createPlainTextEmail(workingLinks),
      MessageStream: "outbound",
    });
    if (result.ErrorCode) {
      console.error(result);
    } else {
      console.log("Email sent");
    }
  }

  await browser.close();
})();
