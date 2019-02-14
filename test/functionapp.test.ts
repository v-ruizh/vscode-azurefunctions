/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { ResourceManagementClient } from 'azure-arm-resource';
import { WebSiteManagementClient, WebSiteManagementModels } from 'azure-arm-website';
import { IHookCallbackContext, ISuiteCallbackContext } from 'mocha';
import * as vscode from 'vscode';
import { AzureTreeDataProvider, DialogResponses, TestAzureAccount, TestUserInput } from 'vscode-azureextensionui';
import { ext } from '../src/extensionVariables';
import { FunctionAppProvider } from '../src/tree/FunctionAppProvider';
import * as fsUtil from '../src/utils/fs';

suite('Function App actions', async function (this: ISuiteCallbackContext): Promise<void> {
    this.timeout(20 * 60 * 1000);
    let resourceName: string;
    const resourceGroupsToDelete: string[] = [];
    const testAccount: TestAzureAccount = new TestAzureAccount();
    suiteSetup(async () => {
        this.timeout(3 * 60 * 1000);
        await testAccount.signIn();
        ext.tree = new AzureTreeDataProvider(FunctionAppProvider, 'azureFunctions.startTesting', undefined, testAccount);
    });
    suiteTeardown(async () => {
        const client: ResourceManagementClient = getResourceManagementClient(testAccount);
        for (const resourceGroup of resourceGroupsToDelete) {
            if (await client.resourceGroups.checkExistence(resourceGroup)) {
                console.log(`Deleting resource group "${resourceGroup}"...`);
                await client.resourceGroups.deleteMethod(resourceGroup);
                console.log(`Resource group "${resourceGroup}" deleted.`);
            } else {
                // If the test failed, the resource group might not actually exist
                console.log(`Ignoring resource group "${resourceGroup}" because it does not exist.`);
            }
        }
    });
    test('createFunctionApp', async function (this: IHookCallbackContext): Promise<void> {
        this.timeout(5 * 60 * 1000);
        resourceName = fsUtil.getRandomHexString();
        resourceGroupsToDelete.push(resourceName);
        const testInputs: string[] = [resourceName, '$(plus) Create new resource group', resourceName, '$(plus) Create new storage account', resourceName, 'East US'];
        ext.ui = new TestUserInput(testInputs);
        await vscode.commands.executeCommand('azureFunctions.createFunctionApp', testAccount.getSubscriptionId());
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp: WebSiteManagementModels.Site = await client.webApps.get(resourceName, resourceName);
        assert.ok(createdApp);
    });
    test('stopFunctionApp', async function (this: IHookCallbackContext): Promise<void> {
        this.timeout(5 * 60 * 1000);
        ext.ui = new TestUserInput([resourceName]);
        await vscode.commands.executeCommand('azureFunctions.stopFunctionApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp1: WebSiteManagementModels.Site = await client.webApps.get(resourceName, resourceName);
        assert.equal(createdApp1.state, 'Stopped', 'Function app State is incorrect.');
    });
    test('startFunctionApp', async function (this: IHookCallbackContext): Promise<void> {
        this.timeout(5 * 60 * 1000);
        ext.ui = new TestUserInput([resourceName]);
        await vscode.commands.executeCommand('azureFunctions.startFunctionApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const createdApp1: WebSiteManagementModels.Site = await client.webApps.get(resourceName, resourceName);
        assert.equal(createdApp1.state, 'Running', 'Function app State is incorrect.');
    });
    test('restartFunctionApp', async function (this: IHookCallbackContext): Promise<void> {
        this.timeout(5 * 60 * 1000);
        let client: WebSiteManagementClient;
        let createdApp1: WebSiteManagementModels.Site;
        ext.ui = new TestUserInput([resourceName]);
        await vscode.commands.executeCommand('azureFunctions.stopFunctionApp');
        client = getWebsiteManagementClient(testAccount);
        createdApp1 = await client.webApps.get(resourceName, resourceName);
        assert.equal(createdApp1.state, 'Stopped', 'Function app State is incorrect.');
        //'Restart' is disabled after stopping a function app in Azure portal.
        ext.ui = new TestUserInput([resourceName, resourceName]);
        await vscode.commands.executeCommand('azureFunctions.restartFunctionApp');
        client = getWebsiteManagementClient(testAccount);
        createdApp1 = await client.webApps.get(resourceName, resourceName);
        assert.equal(createdApp1.state, 'Running', 'Function app State is incorrect.');
    });
    test('deleteFunctionApp', async function (this: IHookCallbackContext): Promise<void> {
        this.timeout(5 * 60 * 1000);
        ext.ui = new TestUserInput([resourceName, DialogResponses.deleteResponse.title, DialogResponses.yes.title]);
        await vscode.commands.executeCommand('azureFunctions.deleteFunctionApp');
        const client: WebSiteManagementClient = getWebsiteManagementClient(testAccount);
        const deletedApp: WebSiteManagementModels.Site | undefined = await client.webApps.get(resourceName, resourceName);
        assert.ifError(deletedApp);
    });
});

function getWebsiteManagementClient(testAccount: TestAzureAccount): WebSiteManagementClient {
    return new WebSiteManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}
function getResourceManagementClient(testAccount: TestAzureAccount): ResourceManagementClient {
    return new ResourceManagementClient(testAccount.getSubscriptionCredentials(), testAccount.getSubscriptionId());
}
