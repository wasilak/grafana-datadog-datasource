"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
exports.__esModule = true;
exports.ConfigEditor = void 0;
var react_1 = require("react");
var ui_1 = require("@grafana/ui");
var SecretFormField = ui_1.LegacyForms.SecretFormField, FormField = ui_1.LegacyForms.FormField;
var ConfigEditor = /** @class */ (function (_super) {
    __extends(ConfigEditor, _super);
    function ConfigEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onSiteChange = function (event) {
            var _a = _this.props, onOptionsChange = _a.onOptionsChange, options = _a.options;
            var jsonData = __assign(__assign({}, options.jsonData), { site: event.target.value });
            onOptionsChange(__assign(__assign({}, options), { jsonData: jsonData }));
        };
        // Secure field (only sent to the backend)
        _this.onAPPKeyChange = function (event) {
            var _a = _this.props, onOptionsChange = _a.onOptionsChange, options = _a.options;
            onOptionsChange(__assign(__assign({}, options), { secureJsonData: __assign(__assign({}, options.secureJsonData), { appKey: event.target.value }) }));
        };
        _this.onResetAPPKey = function () {
            var _a = _this.props, onOptionsChange = _a.onOptionsChange, options = _a.options;
            onOptionsChange(__assign(__assign({}, options), { secureJsonFields: __assign(__assign({}, options.secureJsonFields), { appKey: false }), secureJsonData: __assign(__assign({}, options.secureJsonData), { appKey: '' }) }));
        };
        // Secure field (only sent to the backend)
        _this.onAPIKeyChange = function (event) {
            var _a = _this.props, onOptionsChange = _a.onOptionsChange, options = _a.options;
            onOptionsChange(__assign(__assign({}, options), { secureJsonData: __assign(__assign({}, options.secureJsonData), { apiKey: event.target.value }) }));
        };
        _this.onResetAPIKey = function () {
            var _a = _this.props, onOptionsChange = _a.onOptionsChange, options = _a.options;
            onOptionsChange(__assign(__assign({}, options), { secureJsonFields: __assign(__assign({}, options.secureJsonFields), { apiKey: false }), secureJsonData: __assign(__assign({}, options.secureJsonData), { apiKey: '' }) }));
        };
        return _this;
    }
    ConfigEditor.prototype.render = function () {
        var options = this.props.options;
        var jsonData = options.jsonData, secureJsonFields = options.secureJsonFields;
        var secureJsonData = (options.secureJsonData || {});
        return (<div className="gf-form-group">
        <div className="gf-form">
          <FormField label="Site" labelWidth={6} inputWidth={20} onChange={this.onSiteChange} value={jsonData.site || ''} placeholder="Datadog site"/>
        </div>

        <div className="gf-form-inline">
          <div className="gf-form">
            <SecretFormField isConfigured={(secureJsonFields && secureJsonFields.apiKey)} value={secureJsonData.apiKey || ''} label="API Key" placeholder="secure json field (backend only)" labelWidth={6} inputWidth={20} onReset={this.onResetAPIKey} onChange={this.onAPIKeyChange}/>
          </div>
        </div>

        <div className="gf-form-inline">
          <div className="gf-form">
            <SecretFormField isConfigured={(secureJsonFields && secureJsonFields.appKey)} value={secureJsonData.appKey || ''} label="APP Key" placeholder="Datadog application key" labelWidth={6} inputWidth={20} onReset={this.onResetAPPKey} onChange={this.onAPPKeyChange}/>
          </div>
        </div>
      </div>);
    };
    return ConfigEditor;
}(react_1.PureComponent));
exports.ConfigEditor = ConfigEditor;
