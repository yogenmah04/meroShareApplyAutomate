import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

chromium.use(stealth());

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const tokenPath = path.join(__dirname, "security", "kimiTokens.json");
  const inputPath = path.join(__dirname, "input", "document.jpg");

  if (!fs.existsSync(tokenPath)) {
    console.error("❌ Authentication state not found. Please run 'npm run auth:kimi' first.");
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Identity document not found at: ${inputPath}`);
    console.error("Please place the document you wish to parse at that location and try again.");
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"]
  });

  const context = await browser.newContext({
    storageState: tokenPath
  });

  const page = await context.newPage();

  console.log("Navigating to Kimi...");
  await page.goto("https://www.kimi.com/", { waitUntil: "networkidle" });

  // Wait a moment for redirects
  await delay(2000);

  if (page.url().includes("sign_in") || page.url().includes("login")) {
    console.error("❌ Session expired or invalid. You have been redirected to the login page.");
    console.error("Please run 'npm run auth:kimi' again to renew your session.");
    await browser.close();
    process.exit(1);
  }

  console.log("✅ Successfully authenticated.");

  try {
    console.log("Uploading identity document...");
    
    // We attach the file directly to the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: "attached", timeout: 10000 });
    await fileInput.setInputFiles(inputPath);
    
    // Wait for upload to complete visually (thumbnail appears)
    await delay(3000);

    console.log("Injecting prompt...");
    // Find the prompt input box
    const promptBox = page.locator('[contenteditable="true"], textarea').last();
    await promptBox.waitFor({ state: "visible", timeout: 5000 });
    
    const promptText = "Extract the information from this identity document. Return ONLY a valid JSON object mapping out 'fullName', 'citizenshipNumber', and 'dateOfBirth'. Do not include any other text, markdown formatting, or explanation. Ensure keys exactly match the names provided.";
    
    await promptBox.fill(promptText);
    await delay(500);
    
    // Press Enter to submit
    await page.keyboard.press("Enter");
    console.log("Prompt submitted. Waiting for response...");

    // Wait for the response to generate
    // Since Gemini streams the response, we wait for a specific condition.
    // Usually, the send button turns into a stop button and then back to send.
    await delay(15000); // 15 second basic delay to allow response generation
    
    // Attempt to extract the response
    // The responses are usually inside message blocks. For DeepSeek we will grab all text contents and find the last response.
    const messageLocator = page.locator('div[class*="markdown"]').last();
    // Catch-all locator if the specific markdown class isn't found
    try {
      await messageLocator.waitFor({ state: "visible", timeout: 30000 });
    } catch {
      console.log("Warning: Specific message locator timed out. Falling back.");
    }
    
    // Adding extra wait to ensure stream finishes
    await delay(5000); 

    const finalResponseText = await page.evaluate(() => {
      // Find the last assistant message container
      const blocks = Array.from(document.querySelectorAll('div'));
      // A naive fallback text extraction from the whole page if specific locators fail
      const markdownBlocks = Array.from(document.querySelectorAll('div[class*="markdown"]'));
      if (markdownBlocks.length > 0) {
        return (markdownBlocks[markdownBlocks.length - 1] as HTMLElement).innerText;
      }
      return document.body.innerText;
    });
    
    console.log("\n====== RAW EXTRACTED PAYLOAD ======\n");
    console.log(finalResponseText);
    console.log("\n===================================\n");
    
    // Try to parse it directly
    try {
      // Clean up potential markdown formatting if Gemini ignored instructions
      const jsonMatch = finalResponseText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : finalResponseText;
      const parsedData = JSON.parse(jsonString);
      
      console.log("✅ Successfully parsed JSON:");
      console.log(parsedData);
    } catch (e) {
      console.error("⚠️ Could not automatically parse the response into JSON. See the raw output above.");
    }
    
  } catch (err: any) {
    console.error("❌ An error occurred during automation:", err.message);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
