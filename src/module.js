"use strict";
exports.__esModule = true;
exports.plugin = void 0;
var data_1 = require("@grafana/data");
var datasource_1 = require("./datasource");
var ConfigEditor_1 = require("./ConfigEditor");
var QueryEditor_1 = require("./QueryEditor");
exports.plugin = new data_1.DataSourcePlugin(datasource_1.DataSource)
    .setConfigEditor(ConfigEditor_1.ConfigEditor)
    .setQueryEditor(QueryEditor_1.QueryEditor);
