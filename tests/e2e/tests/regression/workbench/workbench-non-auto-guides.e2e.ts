import { acceptLicenseTermsAndAddDatabaseApi } from '../../../helpers/database';
import { WorkbenchPage, MyRedisDatabasePage, BrowserPage } from '../../../pageObjects';
import { rte } from '../../../helpers/constants';
import { commonUrl, ossStandaloneConfig } from '../../../helpers/conf';
import { deleteStandaloneDatabaseApi } from '../../../helpers/api/api-database';
import { Common } from '../../../helpers/common';

const myRedisDatabasePage = new MyRedisDatabasePage();
const workbenchPage = new WorkbenchPage();
const common = new Common();
const browserPage = new BrowserPage();

const counter = 7;
const unicodeValue = '山女馬 / 马目 abc 123';
const keyName = common.generateWord(10);
const keyValue = '\\xe5\\xb1\\xb1\\xe5\\xa5\\xb3\\xe9\\xa6\\xac / \\xe9\\xa9\\xac\\xe7\\x9b\\xae abc 123';
const commands = [
    `[results=group] \
    ${counter} INFO`,
    `[mode=raw] \
    get ${keyName}`,
    `[mode=raw;results=group;pipeline=3] \
    ${counter} get ${keyName}`,
    `[mode=ascii;results=single] \
    ${counter} get ${keyName}`,
    `[mode=ascii;mode=raw;results=single] \
    ${counter} get ${keyName}`,
    `[mode=raw;results=silent;pipeline=3] \
    ${counter} INFO`,
    `[mode=ascii;results=silent;pipeline=1] \
    ${counter} INFO
    invalidCommand`
];
const commandForSend = `set ${keyName} "${keyValue}"`;

fixture `Workbench modes to non-auto guides`
    .meta({ type: 'regression', rte: rte.standalone })
    .page(commonUrl)
    .beforeEach(async t => {
        await acceptLicenseTermsAndAddDatabaseApi(ossStandaloneConfig, ossStandaloneConfig.databaseName);
        await t.click(myRedisDatabasePage.workbenchButton);
        await workbenchPage.sendCommandInWorkbench(commandForSend);
    })
    .afterEach(async t => {
        // Delete database
        await deleteStandaloneDatabaseApi(ossStandaloneConfig);
    });
test.after(async t => {
    // Clear and delete database
    await t.click(myRedisDatabasePage.browserButton);
    await browserPage.deleteKeyByName(keyName);
    await deleteStandaloneDatabaseApi(ossStandaloneConfig);
})('Workbench modes from editor', async t => {
    const groupCommandResultName = `${counter} Command(s) - ${counter} success, 0 error(s)`;
    const containerOfCommand = await workbenchPage.getCardContainerByCommand(groupCommandResultName);

    // Verify that results parameter applied from the first raw in the Workbench Editor
    await workbenchPage.sendCommandInWorkbench(commands[0]);
    await t.expect(workbenchPage.queryCardCommand.textContent).eql(groupCommandResultName, 'Group mode not applied');
    await t.hover(workbenchPage.parametersAnchor);
    // Verify that group mode icon is displayed
    await t.expect(workbenchPage.groupModeIcon.exists).ok('Group mode icon not displayed');

    // Verify that mode parameter applied from the first raw in the Workbench Editor
    await workbenchPage.sendCommandInWorkbench(commands[1]);
    await workbenchPage.checkWorkbenchCommandResult(commands[1], `"${unicodeValue}"`);
    await t.hover(workbenchPage.parametersAnchor);
    // Verify that raw mode icon is displayed
    await t.expect(workbenchPage.rawModeIcon.exists).ok('Raw mode icon not displayed');

    // Verify that multiple parameters applied from the first raw in the Workbench Editor
    await workbenchPage.sendCommandInWorkbench(commands[2]);
    await t.expect(workbenchPage.queryCardCommand.textContent).eql(groupCommandResultName, 'Group mode not applied');
    await workbenchPage.checkWorkbenchCommandResult(commands[2], `"${unicodeValue}"`);
    await t.hover(workbenchPage.parametersAnchor);
    // Verify that raw and group mode icons are displayed
    await t.expect(workbenchPage.groupModeIcon.exists).ok('Group mode icon not displayed');
    await t.expect(workbenchPage.rawModeIcon.exists).ok('Raw mode icon not displayed');

    // Add text with parameters in Workbench editor input
    await t.typeText(workbenchPage.queryInput, commands[4], { replace: true });
    // Re-run the last command in results
    await t.click(containerOfCommand.find(workbenchPage.cssReRunCommandButton));
    // Verify that on re-run any command from history the same parameters specified regardless of Workbench editor input
    await t.expect(workbenchPage.queryCardCommand.textContent).eql(commands[2], 'The command is not re-executed');

    // Turn on raw and group modes
    await t.click(workbenchPage.rawModeBtn);
    await t.click(workbenchPage.groupMode);
    await workbenchPage.sendCommandInWorkbench(commands[3]);
    // Verify that Workbench Editor parameters have more priority than manually clicked modes
    await t.expect(workbenchPage.queryTextResult.textContent).contains(`"${keyValue}"`, 'The mode is not applied from editor parameters');
    await t.expect(workbenchPage.queryCardCommand.textContent).eql(`get ${keyName}`, 'The result is not applied from editor parameters');

    // Turn off raw and group modes
    await t.click(workbenchPage.rawModeBtn);
    await t.click(workbenchPage.groupMode);
    // Verify that if user specifies the same parameters he can see the first one is applied
    await workbenchPage.sendCommandInWorkbench(commands[4]);
    await t.expect(workbenchPage.queryTextResult.textContent).contains(`"${keyValue}"`, 'The first duplicated parameter not applied');
});
test('Workbench Silent mode', async t => {
    const silentCommandSuccessResultName = `${counter} Command(s) - ${counter} success`;
    const silentCommandErrorsResultName = `${counter + 1} Command(s) - ${counter} success, 1 error(s)`;

    await workbenchPage.sendCommandInWorkbench(commands[5]);
    // Verify that user can see the success command output with header: {number} Command(s) - {number} success
    await t.expect(workbenchPage.queryCardCommand.textContent).eql(silentCommandSuccessResultName, 'Silent mode not applied');
    // Verify that user can see the command output is grouped into one window when run any guide or tutorial with the [results=silent]
    await t.expect(workbenchPage.queryTextResult.exists).notOk('The result is displayed in silent mode');

    await t.hover(workbenchPage.parametersAnchor);
    // Verify that silent mode icon displayed
    await t.expect(workbenchPage.silentModeIcon.exists).ok('Silent mode icon not displayed');

    await workbenchPage.sendCommandInWorkbench(commands[6]);
    // Verify that user can expand the results to see the list of commands with errors and the list of errors per a command
    await t.click(workbenchPage.queryCardContainer.nth(0));
    await t.expect(workbenchPage.queryCardCommand.nth(0).textContent).contains('invalidCommand', 'Silent mode result does not contain error');
    await t.expect(workbenchPage.queryCardCommand.nth(0).textContent).notContains('INFO', 'Silent mode result contains not only errors');
    // Verify that user can see the errors command output with header: {number} Command(s) - {number} success, {number} error(s)
    await t.expect(workbenchPage.queryCardCommand.textContent).eql(silentCommandErrorsResultName, 'Silent mode with errors header text is invalid');
});
