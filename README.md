# Meroshare Automated IPO Scheduler

This project contains a complete automation suite and background scheduling system built with Playwright and Node.js. It allows you to automatically log into Meroshare, identify "Ordinary Shares", fill out the entire application form (Bank, CRN, Applied Kitta, PIN), and submit it—all at exact scheduled times for multiple users simultaneously!

## Prerequisites

1. Node.js installed (v16.0 or higher recommended).
2. All project dependencies installed. Run the following command if you haven't yet:
   ```bash
   npm install
   ```
3. Playwright browsers installed:
   ```bash
   npx playwright install
   ```
4. Typescript processor installed (if running scripts directly):
   ```bash
   npm install -g ts-node typescript
   ```

## Configuration

To handle multiple accounts and schedule unique application times, the core configurations are handled inside a `users.json` file. 

Create or modify `users.json` at the root of the project to match your credentials:

```json
[
  {
    "id": 1,
    "dp": "130 - XYZ CAPITAL LTD.",
    "username": "user1",
    "password": "password123",
    "crn": "01563127",
    "pin": "5965",
    "kitta": "10",
    "applyAt": "2026-04-10T10:15:00" 
  },
  {
    "id": 2,
    "dp": "130 - XYZ CAPITAL LTD.",
    "username": "user2",
    "password": "password456",
    "crn": "02020202",
    "pin": "1234",
    "kitta": "10",
    "applyAt": "2026-05-11T12:00:00" 
  }
]
```

### Explanation of JSON Fields:
- `dp`: Your exact Depository Participant as it appears in the dropdown (Ex: `"130 - XYZ CAPITAL LTD."`).
- `crn`: Your unique CRN Number.
- `pin`: Your 4-digit transaction verification PIN.
- `kitta`: How many shares to apply for.
- `applyAt`: The exact scheduled time the script should wake up and run. Use standard ISO Time (`YYYY-MM-DDTHH:MM:SS`). **Must be in the future.**

## How to Run the Scheduled Flow

Once your `users.json` is ready, launch the primary scheduler. 

```bash
npx ts-node scheduler.ts
```

- When you start this file, it will load all the users in `users.json` and silently idle in the background. 
- When the internal clock reaches the target `applyAt` time for a specific user, it automatically jumps into the `automate.ts` logic.
- It will open the Playwright browser, execute the full Meroshare UI login, search for an unapplied standard IPO, enter data, wait 5 seconds for visual confirmation, add the PIN, and apply!
- *(Note: Ensure the machine running `scheduler.ts` stays powered on at the scheduled time!)*

## Stock Status Checker

You can now check the allotment status of specific stocks for all users in your `users.json` file.

### 1. Configuration

- **`checkStockStatus.json`**: Add the names of the stocks you want to check in this file. It should be an array of strings.
  ```json
  [
    "Palpa Cement Industries Limited",
    "Some Other Stock Name"
  ]
  ```

### 2. How to Run

Execute the following command to start the status check:

```bash
npm run check-status
```

### 3. Viewing Results

The results will be saved (and appended) to a file named `reportStatus.json`. It will maintain a list of status results grouped by stock name.

```json
[
  {
    "stockName": "Palpa Cement Industries Limited",
    "nameStatusList": [
      {
        "name": "Yogen Maharjan",
        "status": "Allotted"
      }
    ]
  }
]
```

## Security Notes
The project is configured out-of-the-box (`.gitignore`) to prevent sensitive files like `users.json`, `.env`, and now `reportStatus.json` from being pushed to public GitHub repositories.


npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' scheduler.ts