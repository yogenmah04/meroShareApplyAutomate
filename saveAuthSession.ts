import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import readline from "readline";
import fs from "fs";
import path from "path";

chromium.use(stealth());

async function run() {
  const securityDir = path.join(__dirname, "security");
  if (!fs.existsSync(securityDir)) {
    fs.mkdirSync(securityDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"]
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to Kimi...");
  await page.goto("https://www.kimi.com/");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("=======================================================");
  console.log("⏸️  Please log into your Kimi Account in the browser.");
  console.log("Once you have successfully logged in and can see the Kimi chat interface, return here.");
  console.log("=======================================================\n");

  await new Promise<void>((resolve) => {
    rl.question("Press [ENTER] when you have finished logging in...", () => {
      resolve();
    });
  });

  rl.close();

  console.log("Saving session state...");
  const tokenPath = path.join(securityDir, "kimiTokens.json");
  await context.storageState({ path: tokenPath });
  console.log(`✅ Session saved successfully to: ${tokenPath}`);

  await browser.close();
}

run().catch(console.error);
