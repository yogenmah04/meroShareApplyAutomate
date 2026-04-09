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

## Security Notes
The project is configured out-of-the-box (`.gitignore`) to prevent sensitive files like `users.json` or `.env` from being pushed to public GitHub repositories. Do not override this behavior.
