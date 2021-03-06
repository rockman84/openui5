/*!
 * ${copyright}
 */

// Provides class sap.ui.dt.Plugin.
sap.ui.define([
	'sap/ui/dt/Plugin',
	'sap/ui/fl/Utils',
	'sap/ui/fl/registry/ChangeRegistry',
	'sap/ui/dt/OverlayRegistry',
	'sap/ui/dt/OverlayUtil'
],
function(
	Plugin,
	FlexUtils,
	ChangeRegistry,
	OverlayRegistry,
	OverlayUtil
) {
	"use strict";

	/**
	 * Constructor for a new Plugin.
	 *
	 * @param {string} [sId] id for the new object, generated automatically if no id is given
	 * @param {object} [mSettings] initial settings for the new object
	 *
	 * @class
	 * The Plugin allows to handle the overlays and aggregation overlays from the DesignTime
	 * The Plugin should be overriden by the real plugin implementations, which define some actions through events attached to an overlays
	 * @extends sap.ui.dt.Plugin
	 *
	 * @author SAP SE
	 * @version ${version}
	 *
	 * @constructor
	 * @private
	 * @since 1.46
	 * @alias sap.ui.rta.plugin.Plugin
	 * @experimental Since 1.46. This class is experimental and provides only limited functionality. Also the API might be changed in future.
	 */

	var BasePlugin = Plugin.extend("sap.ui.rta.plugin.Plugin", /** @lends sap.ui.dt.Plugin.prototype */ {
		metadata : {
			"abstract" : true,
			// ---- object ----

			// ---- control specific ----
			library : "sap.ui.rta",
			properties : {
				commandFactory : {
					type : "object",
					multiple : false
				}
			},
			events : {
				elementModified : {
					command : {
						type : "sap.ui.rta.command.BaseCommand"
					}
				}
			}
		}
	});

	BasePlugin.prototype._isEditable = function() {};

	BasePlugin.prototype._attachReevaluationEditable = function(oOverlay) {
		oOverlay.attachElementModified(function(oEvent) {
			var oParams = oEvent.getParameters();
			if ((oParams.type === "propertyChanged" && oParams.name === "visible") || oParams.type === "insertAggregation" || oParams.type === "removeAggregation") {
				if (oOverlay.getRelevantOverlays().length === 0) {
					var aRelevantOverlays = OverlayUtil.findAllOverlaysInContainer(oOverlay);
					oOverlay.setRelevantOverlays(aRelevantOverlays);
				}
				this.evaluateEditable(oOverlay.getRelevantOverlays());
			}
		}.bind(this));
	};

	BasePlugin.prototype.evaluateEditable = function(aOverlays) {
		aOverlays.forEach(function(oOverlay) {
			// when a control gets destroyed it gets deregistered before it gets removed from the parent aggregation.
			// this means that getElementInstance is undefined when we get here via removeAggregation mutation
			if (oOverlay.getElementInstance() && this._isEditable(oOverlay)) {
				this.addToPluginsList(oOverlay);
			} else {
				this.removeFromPluginsList(oOverlay);
			}
		}.bind(this));
	};

	BasePlugin.prototype._isEditableByPlugin = function(oOverlay) {
		var sPluginName = this.getMetadata().getName();
		var aPluginList = oOverlay.getEditableByPlugins();
		return aPluginList.indexOf(sPluginName) > -1;
	};

	BasePlugin.prototype.registerElementOverlay = function(oOverlay) {
		this.evaluateEditable([oOverlay]);
		this._attachReevaluationEditable(oOverlay);
	};

	BasePlugin.prototype.deregisterElementOverlay = function(oOverlay) {
		this.removeFromPluginsList(oOverlay);
	};

	BasePlugin.prototype.hasStableId = function(oOverlay) {
		if (!oOverlay) {
			return false;
		} else if (!oOverlay.getDesignTimeMetadata()) {
			return FlexUtils.checkControlId(oOverlay.getElementInstance());
		}

		var bStable = false;
		var oDesignTimeMetadata = oOverlay.getDesignTimeMetadata();
		var oElement = oOverlay.getElementInstance();

		var fnGetStableElements = oDesignTimeMetadata.getData().getStableElements;

		if (fnGetStableElements) {
			var aStableElements = fnGetStableElements(oElement);
			var bUnstable = aStableElements ? aStableElements.some(function(vStableElement) {
				var oControl = vStableElement.id || vStableElement;
				if (!FlexUtils.checkControlId(oControl, vStableElement.appComponent)) {
					return true;
				}
			}) : true;
			bStable = !bUnstable;
		} else {
			bStable = FlexUtils.checkControlId(oElement);
		}
		return bStable;
	};

	BasePlugin.prototype.getVariantManagementReference = function (oOverlay, oAction, bForceRelevantContainer) {
		var oElement = oOverlay.getElementInstance();
		var oRelevantElement;
		if (oAction.changeOnRelevantContainer || bForceRelevantContainer) {
			oRelevantElement = oOverlay.getRelevantContainer();
		} else {
			oRelevantElement = oElement;
		}

		var sVariantManagementReference;
		if (oOverlay.getVariantManagement && this._hasVariantChangeHandler(oAction.changeType, oRelevantElement)) {
			sVariantManagementReference = oOverlay.getVariantManagement();
		}
		return sVariantManagementReference;
	};

	BasePlugin.prototype._hasVariantChangeHandler = function (sChangeType, oElement){
		var oChangeHandler = this._getChangeHandler(sChangeType, oElement);
		return (oChangeHandler && oChangeHandler.revertChange);
	};

	/**
	 * Checks the Aggregations on the Overlay for a specific Action
	 * @name sap.ui.rta.plugin.Plugin.prototype.checkAggregationsOnSelf
	 * @param {sap.ui.dt.ElementOverlay} oOverlay overlay to be checked for action
	 * @param {string} sAction action to be checked
	 * @return {boolean} whether the Aggregation has a valid Action
	 * @protected
	 */
	BasePlugin.prototype.checkAggregationsOnSelf = function (oOverlay, sAction) {
		var oDesignTimeMetadata = oOverlay.getDesignTimeMetadata();
		var oElement = oOverlay.getElementInstance();
		var bIsEditable = false;

		var oAction = oDesignTimeMetadata.getAggregationAction(sAction, oOverlay.getElementInstance())[0];
		var sChangeType = oAction ? oAction.changeType : null;
		var bChangeOnRelevantContainer = oAction && oAction.changeOnRelevantContainer;
		if (bChangeOnRelevantContainer) {
			oElement = oOverlay.getRelevantContainer();
		}

		if (sChangeType && this.hasChangeHandler(sChangeType, oElement)) {
			bIsEditable = true;
		}

		return bIsEditable;
	};

	BasePlugin.prototype.removeFromPluginsList = function(oOverlay) {
		oOverlay.removeEditableByPlugin(this.getMetadata().getName());
		if (!oOverlay.getEditableByPlugins().length) {
			oOverlay.setEditable(false);
		}
	};

	BasePlugin.prototype.addToPluginsList = function(oOverlay) {
		oOverlay.addEditableByPlugin(this.getMetadata().getName());
		oOverlay.setEditable(true);
	};

	BasePlugin.prototype.hasChangeHandler = function(sChangeType, oElement) {
		return !!this._getChangeHandler(sChangeType, oElement);
	};

	BasePlugin.prototype._getChangeHandler = function(sChangeType, oElement) {
		var sControlType = oElement.getMetadata().getName();
		return this._getChangeHandlerForControlType(sControlType, sChangeType);
	};

	BasePlugin.prototype._getChangeHandlerForControlType = function(sControlType, sChangeType) {
		var oResult = ChangeRegistry.getInstance().getRegistryItems({
			controlType : sControlType,
			changeTypeName : sChangeType,
			layer: this.getCommandFactory().getFlexSettings().layer
		});
		if (oResult && oResult[sControlType] && oResult[sControlType][sChangeType]) {
			var oRegItem = oResult[sControlType][sChangeType];
			return oRegItem.getChangeTypeMetadata().getChangeHandler();
		}
		return undefined;
	};

	return BasePlugin;
}, /* bExport= */ true);
