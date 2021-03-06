/*global describe,it,element,by,takeScreenshot,expect, browser, protractor*/

describe("sap.m.ContextMenuSupportIntegration", function() {
	"use strict";


	var bDesktop = null;

	var aTestElements = [
		{
			name: "Button",
			id: "buttonSample"
		},
		{
			name: "First List Item",
			id: "firstItem"
		},
		{
			name: "Down Left Button",
			id: "leftDownBtn"
		},
		{
			name: "Down Right Button",
			id: "rightDownBtn"
		},
		{
			name: "Last List Item",
			id: "lastItem"
		}
	];

	it("should load test page",function(){
		browser.executeScript(
			"return sap.ui.Device.system.desktop;")
			.then(function (response) {
				bDesktop = response;
		});

		expect(takeScreenshot()).toLookAs("initial");
	});

	aTestElements.forEach(function (oElement) {
		it("should open content menu for " + oElement.name + ".", function () {
			var oElementRef = element(by.id(oElement.id));
			if (bDesktop) {
				// right-click for desktop
				browser.actions().mouseMove(oElementRef).perform();
				browser.actions().click(protractor.Button.RIGHT).perform();

				expect(takeScreenshot(element(by.id(oElement.id)))).toLookAs(oElement.id + "-contextMenu");
			} else {
				// long press on mobile devices
				browser.actions().mouseDown(oElementRef).perform();
				browser.sleep(1000);
				browser.actions().mouseUp(oElementRef).perform();

				expect(takeScreenshot(element(by.id(oElement.id)))).toLookAs(oElement.id + "-contextMenu-mobile");
			}
		});
	});
});
