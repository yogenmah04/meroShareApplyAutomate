# Meroshare Automation - Technical Documentation

This document provides a detailed breakdown of all files and functions within the Meroshare automation system. The system is designed to automate IPO applications and allotment status checks, managed entirely through Google Sheets.

---

## 🏗️ Architecture Overview

The system operates in three layers:
1.  **Orchestration Layer (`syncService.ts`)**: Polls Google Sheets for commands and triggers the appropriate scripts.
2.  **Service Layer (`googleSheetsService.ts`)**: Handles all communication with the Google Sheets API.
3.  **Automation Layer**: Independent scripts that perform browser actions using Playwright.

---

## 📁 File & Function Breakdown

### 1. `syncService.ts` (The Orchestrator)
*   **Purpose**: The main entry point for the background service. It acts as a "watcher" that monitors your Google Sheet for instructions.
*   **Key Logic**:
    -   **Polling Loop**: Every 30 seconds, it reads the `Control` tab.
    -   **Command Dispatcher**: Triggers `runCheckStatus` or `initializeScheduler` based on the value in the `Command` cell.
    -   **Status Reporting**: Updates the `Status` and `Message` columns in the sheet to tell you what it’s doing in real-time.
*   **Usage**: `npm run watch-sheets`

### 2. `googleSheetsService.ts` (The Data Bridge)
*   **Purpose**: Abstracts the complexity of the Google Sheets API.
*   **Key Functions**:
    -   `initSheets()`: Establishes a secure connection using your Service Account credentials.
    -   `fetchUsersFromSheet()`: Downloads all user credentials and settings from the `Users` tab.
    -   `fetchStocksFromSheet()`: Retrieves the list of stocks to be checked from the `Stocks` tab.
    -   `getControlCommand()`: Reads the current command and provides a way to update the system status.
    -   `addResultToSheet(stock, user, status)`: Append-only function that logs new allotment results to the `Results` tab.

### 3. `checkStatus.ts` (The Status Checker)
*   **Purpose**: Automates the "My ASBA" -> "Application Report" flow to find if an IPO has been allotted.
*   **Key Functions**:
    -   `runCheckStatus(users, stocks, onResult)`: The main logic that launches parallel browsers (using concurrency control) to check each user's status.
    -   `login(page, user)`: Handles the multi-step Meroshare login (DP selection, username, and password).
*   **Feature**: Supports **Concurrency Control** via `p-limit` to process multiple users at once.

### 4. `automate.ts` (The IPO Applicant)
*   **Purpose**: Automates the process of applying for a new IPO.
*   **Key Logic**:
    -   Navigates to "My ASBA".
    -   Scans for "Ordinary Shares" that are currently open for "Apply".
    -   Fills the bank selection, Kitta (units), CRN, and transaction PIN automatically.
*   **Safety**: Includes a 5-second "visual verification" pause before clicking the final proceed button.

### 5. `scheduler.ts` (The Time-Based Trigger)
*   **Purpose**: Waits for a specific date and time to run the application script.
*   **Key Functions**:
    -   `initializeScheduler(users)`: Iterates through users and sets up a `node-schedule` job for each based on their `ApplyAt` column in Google Sheets.

### 6. `humanUtils.ts` (The Stealth Toolkit)
*   **Purpose**: Contains helper functions that make the automation look like a human user to avoid bot detection.
*   **Key Helpers**:
    -   `humanType()`: Types character-by-character with random delays.
    -   `humanClick()`: Moves the mouse over an element before clicking.
    -   `jitterSleep()`: Adds random pauses (e.g., 2-5 seconds) instead of a fixed wait time.
    -   `getRandomUserAgent()`: Gives each browser session a unique identity.

### 7. `testStealth.ts` (The Debugger)
*   **Purpose**: A simple tool to verify if the stealth settings are working.
*   **Usage**: `npx ts-node testStealth.ts`. It takes a screenshot of a bot-detection test site.

---

## ⚙️ Configuration (`.env`)

These settings control the core behavior of the scripts:
-   `CONCURRENCY_LIMIT`: Number of users to check at the same time (Recommended: 2).
-   `HUMAN_MODE`: If `true`, enables typing delays and jitter (Highly recommended for stealth).
-   `GOOGLE_SHEET_ID`: The ID from your browser's address bar when looking at your sheet.

---

## 📊 Google Sheet Structure

| Tab Name | Required Headers | Description |
| :--- | :--- | :--- |
| **Users** | `DP, Username, Password, CRN, PIN, Kitta, ApplyAt, Name, isApply` | Credential database. |
| **Stocks** | `Stock Name` | Names of stocks to check status for. |
| **Results** | `Timestamp, Stock Name, User Name, Status` | Automated output log. |
| **Control** | `Command, Status, Last Run, Message` | Command center (Command is in A2). |
