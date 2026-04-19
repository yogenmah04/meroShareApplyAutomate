make a new automate file script for check stock status  of given stock name of whole list, also update readme.md file to run this file

setps:-

login user, user list called file as users.json as
	"[
  {
    "id": 1,
    "dp": "PRABHU CAPITAL LIMITED (12600)",
    "username": "00243878",
    "password": "...",
    "crn": "...",
    "pin": "..",
    "kitta": "..",
    "applyAt": "...",
    "name": "Yogen Maharjan",
    "isApply": false
  },]" you need only data ["dp","username","password","name"]
side bar menu select "MY ASBA"
select tab "Application Report" = xpath "//*[@id="main"]/div/app-asba/div/div[1]/div/div/ul/li[3]/a"
there will be list of stock, select give name stock name and click button "Report" ,there will be file contain name list to check stock called as "checkStockStatus.json" array list
after clicked report button, check for status section get that status and put in one file called name "reportStatus.json" or append according to this
	" {"stockName" : .... ,
		nameStatusList:[
	{name :.......,
	  status: .......,},
	  {name :.......,
	  status: .......,},
	  ],
	  "stockName" : .... ,
		nameStatusList:[
	{name :.......,
	  status: .......,},
	  {name :.......,
	  status: .......,},
	  ]
	  }"
	  
	  
login script and upto sidebar select "MY ASBA" "console.log('Navigating to Meroshare...');
    await page.goto('https://meroshare.cdsc.com.np/');

    // Select the DP
    const dpSelect = page.locator('.select2-selection__rendered');
    await dpSelect.waitFor({ state: 'visible' });
    await dpSelect.click();

    const dpSearchInput = page.locator('.select2-search__field');
    await dpSearchInput.waitFor({ state: 'visible' });
    await dpSearchInput.fill(dp);
    await page.keyboard.press('Enter');

    // Enter Username and Password
    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill(password);

    // Click Login
    console.log('Logging in...');
    const loginButton = page.locator('button[type="submit"]', { hasText: 'Login' });
    await loginButton.click();

    // Verify Login Success (wait for dashboard to load or something specific)
    // Wait for network to be idle or wait for a specific dashboard element
    await page.waitForTimeout(5000);

    // --> ADD YOUR CUSTOM AUTOMATION STEPS HERE <--
    console.log('Clicking on sidebar item...');
    const targetLink = page.locator('//*[@id="sideBar"]/nav/ul/li[8]/a');
    await targetLink.waitFor({ state: 'visible', timeout: 15000 });
    await targetLink.click();
    console.log('Clicked sidebar item successfully.');"


