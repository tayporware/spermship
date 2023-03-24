const puppeteer = require("puppeteer");
const fs = require("fs");

/** SETTINGS */
/** The script will salt the email for you, eg. youremail+123@gmail.com */
const BASE_EMAIL = "youremail@gmail.com";
const PASSWORD = "spermship123!";
const KEY_FILE_NAME = "keys.txt";

/** Don't fuck with this */
const COOLDOWN = 10000;

async function createAccount(page, email, password) {
  await page.goto("https://www.steamship.com/api/auth/login?returnTo=/");

  await page.$$eval("a", (anchors) => {
    const signUpLink = anchors.find((a) =>
      a.getAttribute("href").startsWith("/u/signup")
    );
    if (signUpLink) {
      signUpLink.click();
    } else {
      console.log("No 'Sign up' link found");
    }
  });

  await page.waitForSelector("input#email");
  await page.type("input#email", email);
  await page.waitForSelector("input#password");
  await page.type("input#password", password);

  await page.click('button[type="submit"]');

  await page.waitForNavigation();
}

async function login(page, email, password) {
  await page.goto("https://www.steamship.com/api/auth/login?returnTo=/");

  await page.waitForSelector("input#username");
  await page.type("input#username", email);
  await page.waitForSelector("input#password");
  await page.type("input#password", password);

  await page.click('button[type="submit"]');

  await page.waitForNavigation();
}

async function getApiKey(page) {
  await page.goto("https://www.steamship.com/account");

  const apiKey = await page.evaluate(async () => {
    const scriptElement = document.getElementById("__NEXT_DATA__");
    if (scriptElement) {
      const nextData = JSON.parse(scriptElement.textContent);
      return nextData.props.pageProps.user.apiKey;
    } else {
      return null;
    }
  });

  return apiKey;
}

(async () => {
  if (!fs.existsSync(KEY_FILE_NAME)) {
    console.log("Creating empty key list.");
    fs.writeFileSync(KEY_FILE_NAME, "");
  } else {
    const fileContent = fs.readFileSync(KEY_FILE_NAME, "utf-8");
    const lines = fileContent.split("\n").filter((line) => line.trim() !== "");
    console.log(`Found ${lines.length} existing keys.`);
  }

  const keysToCreate = getKeysToCreate();
  const browser = await puppeteer.launch({ headless: false });
  let retries = 0;

  try {
    for (let i = 0; i < keysToCreate; i++) {
      console.log("Creating key", i + 1);
      const email =
        BASE_EMAIL.substring(0, BASE_EMAIL.indexOf("@")) +
        `+${Math.random().toString(36).slice(2, 10)}` +
        BASE_EMAIL.substring(BASE_EMAIL.indexOf("@"));

      const browserContext = await browser.createIncognitoBrowserContext();
      const page = await browserContext.newPage();

      // await login(page, BASE_EMAIL, PASSWORD);
      await createAccount(page, email, PASSWORD);
      console.log("\tCreated account with email", email);

      const apiKey = await getApiKey(page);
      if (apiKey) {
        console.log("\tGrabbed API key:", apiKey);
        fs.appendFileSync(KEY_FILE_NAME, apiKey + "\n");
        console.log("\tSaved to disk. Waiting for cooldown...");
      } else {
        console.log("Couldn't find API key, possible issue creating account.");
        if (retries > 5) {
          throw new Error("Retry limit exceeded");
        }
        console.log("Retrying...");
        await page.waitForTimeout(COOLDOWN);
        await page.close();
        await browserContext.close();
        i--;
        continue;
      }

      await page.waitForTimeout(COOLDOWN);
      await page.close();
      await browserContext.close();
    }
  } catch (e) {
    console.error("An error occurred.", e);
  }

  console.log("Use Ctrl+C to exit.");
  // await browser.close();
})();

function getKeysToCreate() {
  const arg = process.argv.find(
    (arg) => arg.startsWith("--keysToCreate") || arg.startsWith("--keys")
  );
  if (arg) {
    const [_, value] = arg.split("=");
    if (value) {
      return value;
    }
  }
  console.log("No --keysToCreate specified.  Creating 3 keys.");
  return 3;
}

async function debugPage(page) {
  await page.screenshot({ path: "debug_screenshot.png" });
  const dom = await page.content();
  fs.writeFileSync("debug_dom.html", dom);
}
