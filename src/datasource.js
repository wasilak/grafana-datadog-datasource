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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.DataSource = void 0;
var data_1 = require("@grafana/data");
var lodash_1 = require("lodash");
var runtime_1 = require("@grafana/runtime");
var DataSource = /** @class */ (function (_super) {
    __extends(DataSource, _super);
    function DataSource(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.routePath = '/wasilak-datadog-datasource';
        _this.url = instanceSettings.url;
        return _this;
    }
    DataSource.prototype.doRequest = function (from, to, query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var parsedQuery, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        parsedQuery = (0, runtime_1.getTemplateSrv)().replace(query.queryText, options.scopedVars, 'csv');
                        return [4 /*yield*/, (0, runtime_1.getBackendSrv)().datasourceRequest({
                                method: 'GET',
                                url: this.url + this.routePath + '/api/v1/query?from=' + from + '&to=' + to + '&query=' + parsedQuery
                            })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    DataSource.prototype.query = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var range, from, to, promises;
            var _this = this;
            return __generator(this, function (_a) {
                range = options.range;
                from = range.from.valueOf() / 1000;
                to = range.to.valueOf() / 1000;
                promises = options.targets.map(function (query) {
                    var frames = [];
                    if (!('queryText' in query)) {
                        return frames;
                    }
                    if (query.hide) {
                        return frames;
                    }
                    return _this.doRequest(from, to, query, options)
                        .then(function (datadogData) {
                        if ('error' in datadogData.data) {
                            throw new Error(datadogData.data.error);
                        }
                        for (var _i = 0, _a = datadogData.data.series; _i < _a.length; _i++) {
                            var s = _a[_i];
                            var seriesName = s.metric + ' {' + s.tag_set.join(', ') + '}';
                            if ('label' in query && query.label.length > 0) {
                                seriesName = query.label;
                                for (var i in s.tag_set) {
                                    var tag = s.tag_set[i];
                                    var splitTag = tag.split(':');
                                    if (seriesName.includes('$' + splitTag[0])) {
                                        seriesName = seriesName.split('$' + splitTag[0]).join(splitTag[1]);
                                    }
                                }
                            }
                            var frame = new data_1.MutableDataFrame({
                                refId: query.refId,
                                name: seriesName,
                                fields: [
                                    { name: 'Time', type: data_1.FieldType.time },
                                    { name: 'Value', type: data_1.FieldType.number },
                                ]
                            });
                            for (var _b = 0, _c = s.pointlist; _b < _c.length; _b++) {
                                var point = _c[_b];
                                frame.appendRow(point);
                            }
                            frames.push(frame);
                        }
                        return frames;
                    })["catch"](function (error) {
                        if ('data' in error && 'errors' in error.data) {
                            throw new Error(error.data.errors.join('; '));
                        }
                        else {
                            throw new Error(error);
                        }
                    });
                });
                return [2 /*return*/, Promise.all(promises).then(function (targetData) {
                        var result = [];
                        lodash_1["default"].each(targetData, function (targetAndData) {
                            // Flatten the list as Grafana expects a list of targets with corresponding datapoints.
                            result.push(targetAndData);
                        });
                        return { data: lodash_1["default"].flatten(result) };
                    })];
            });
        });
    };
    DataSource.prototype.fetchMetricNames = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var parsedQuery, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        parsedQuery = (0, runtime_1.getTemplateSrv)().replace(query, options.scopedVars);
                        return [4 /*yield*/, (0, runtime_1.getBackendSrv)().datasourceRequest({
                                method: 'GET',
                                url: this.url + this.routePath + '/api/v2/metrics/' + parsedQuery + '/all-tags'
                            })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.data.data.attributes.tags];
                }
            });
        });
    };
    DataSource.prototype.metricFindQuery = function (query, options) {
        return __awaiter(this, void 0, void 0, function () {
            var splitQuery, response, values;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        splitQuery = query.split('|');
                        return [4 /*yield*/, this.fetchMetricNames(splitQuery[0], options)];
                    case 1:
                        response = _a.sent();
                        values = response.map(function (frame) {
                            var textArray = frame.split(':');
                            if (splitQuery[1] === textArray[0]) {
                                return { text: textArray[1] };
                            }
                            return false;
                        });
                        // removing empty values
                        values = values.filter(Boolean);
                        return [2 /*return*/, values];
                }
            });
        });
    };
    DataSource.prototype.testDatasourceRequest = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, runtime_1.getBackendSrv)().datasourceRequest({
                            method: 'GET',
                            url: this.url + this.routePath + '/api/v1/tags/hosts'
                        })];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    DataSource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.testDatasourceRequest()];
                    case 1:
                        response = _a.sent();
                        if ('error' in response.data) {
                            throw new Error(response.data.error);
                        }
                        return [2 /*return*/, {
                                status: 'success',
                                message: 'Success'
                            }];
                }
            });
        });
    };
    return DataSource;
}(data_1.DataSourceApi));
exports.DataSource = DataSource;
