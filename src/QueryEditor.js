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
exports.QueryEditor = void 0;
var defaults_1 = require("lodash/defaults");
var react_1 = require("react");
var ui_1 = require("@grafana/ui");
var FormField = ui_1.LegacyForms.FormField;
var QueryEditor = /** @class */ (function (_super) {
    __extends(QueryEditor, _super);
    function QueryEditor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onBlur = function () {
            var onRunQuery = _this.props.onRunQuery;
            // executes the query
            onRunQuery();
        };
        _this.onQueryTextChange = function (event) {
            var _a = _this.props, onChange = _a.onChange, query = _a.query;
            onChange(__assign(__assign({}, query), { queryText: event.target.value }));
        };
        _this.onQueryLabelChange = function (event) {
            var _a = _this.props, onChange = _a.onChange, query = _a.query;
            onChange(__assign(__assign({}, query), { label: event.target.value }));
        };
        return _this;
    }
    QueryEditor.prototype.render = function () {
        var query = (0, defaults_1["default"])(this.props.query);
        var queryText = query.queryText, label = query.label;
        return (<div>
        <div className="gf-form max-width">
          <FormField labelWidth={0} value={queryText || ''} onChange={this.onQueryTextChange} onBlur={this.onBlur} label="Query" tooltip="Datadog query, see: https://docs.datadoghq.com/metrics/advanced-filtering/" className="max-width" inputWidth={0}/>
        </div>
        <div className="gf-form max-width">
          <FormField labelWidth={0} value={label || ''} onChange={this.onQueryLabelChange} onBlur={this.onBlur} label="Label" tooltip="nope." className="max-width" inputWidth={0}/>
        </div>
      </div>);
    };
    return QueryEditor;
}(react_1.PureComponent));
exports.QueryEditor = QueryEditor;
