/**
 * Created by wangxin on 15/10/3.
 */

'use strict';

var fs = require('fs');
var PATH = require('path');
var iconv = require('iconv-lite');

var browserify = require('browserify');
var Imagemin = require('imagemin');

var distrbute = require('./lib/distrbute');
var trace = require('./lib/trace');
var outputHandle = require('./lib/output');
var listener = require('./lib/listener');
var util = require('./lib/util');

/*
 * @author wangxin
 * 获取执行任务的参数
 * file: 文件路径
 * return object;
 */
function getArgs(file) {
    var o = arguments[1] || {},
        type = arguments[2] || null,
        i = 0, len = file.length;

    if (len == 0) return o;
    for (; i < len; i++) {
        var path = PATH.resolve(file[i]);
        if (!type || type == 'built' || type == 'change') {
            !o[path] && (o[path] = file[i]);
        } else if (type === 'removed') {
            delete o[path];
        }
    }
    return o;
}

/*
 * @author wangxin
 * 获取一个mod文件父文件夹下的RJS文件
 * return arr ['dirPath','dirPath',...]
 */
function getRJSFiles(files) {
    if (files.length == 0) return [];

    var arr = [],
        rjsDirectory = files[0].replace(/mod[\/\\].+$/g, ''),
        rjsFiles = fs.readdirSync(rjsDirectory);

    rjsFiles.forEach(function (fileName) {
        var file = rjsDirectory + fileName;
        util.testRJS(file) && arr.push(file);
    });

    return arr;
}

/*
 * @author wangxin
 * 获取一个文件下所有文件路径
 * return arr ['dirPath','dirPath',...]
 */
function getLibraryMap(fileDir) {
    var files = fs.readdirSync(fileDir), arr = arguments[1] || [];
    files.forEach(function (fileName) {
        var baseDir = fileDir + fileName, lstat = fs.lstatSync(baseDir);
        if (lstat.isDirectory()) {
            getLibraryMap(baseDir + PATH.sep, arr);
        } else {
            var file = PATH.dirname(baseDir);
            arr.indexOf(file) === -1 && arr.push(PATH.normalize(file));
        }
    });
    return arr;
}

/*
 * @author wangxin
 * 进行browserify编译
 * content: 文件内容，string;
 * outputPath: 输出文件路径
 * return;
 */
function doBrowserify(basePath, libraryMap, config, index, cb) {
    var b = new browserify({
        entries: basePath,
        paths: libraryMap,
        debug: config.rjs.debug || false
    });
    b.bundle(function (err, code) {
        if (err) {
            module.timer && clearTimeout(module.timer);
            module.timer = setTimeout(function () {
                module.timer && clearTimeout(module.timer);
                module.timer = null;
                cb && cb(index + 1);
            }, 50);
            trace.error(String(err));
        } else {
            //browserify编译完成，开始输出
            outputHandle(iconv.decode(code, 'utf8'), basePath, config, 'rjs');
            code = null;
            cb && cb(index + 1);
        }
    });
}

/*
 * @author wangxin
 * 处理加载模块文件内容为路径名
 * rjsMap: rjs文件map对象
 * libraryMap: 库文件map对象
 * return false;
 */
function walk(rjsMap, libraryMap, opt, cb) {

    var arr = [], go = function (i) {
        if (arr[i]) {
            doBrowserify(arr[i], libraryMap, opt, i, go);
        } else {
            cb && cb();
        }
        return false;
    };

    for (var i in rjsMap) {
        if (!i) {
            trace.error('file error');
            break;
        }
        if (rjsMap.hasOwnProperty(i))  arr.push(rjsMap[i]);
    }

    //开始编译
    return go(0);
}

/*
 * @author wangxin
 * 文件压缩==>js、css文件
 * opts: 输出路径：文件路径
 * retrun；
 */
function doMinify(map, opts, type) {
    for (var i in map) {
        var con = fs.readFileSync(map[i]), charset;
        //这里不建议用gbk编码格式
        if (iconv.decode(con, 'gbk').indexOf('�') != -1) {
            charset = 'utf8';
        } else {
            charset = 'gbk';
        }

        outputHandle(iconv.decode(con, charset), map[i], opts, type);
        con = null;
    }
}

/*
 * @author wangxin
 * 压缩图片
 * opts: 输出路径：文件路径
 * retrun；
 */
function imin(map, opts, cb) {
    var arr = [];
    for (var i in map) arr.push(map[i]);

    trace.load('image compressed, waiting...');

    ~function () {
        new Imagemin().src(arr).dest(PATH.normalize(opts.image.output.path)).run(function () {
            cb && cb()
        });
    }();
}

/*
 * @author wangxin
 * 初始化方法
 * opts: 配置参数
 * 详情参考 ../test/test.js ==> config
 */
module.exports = function (config) {

    var opts = util.extendDeep(config);

    var libraryMap = [];

    /**
     * 文件路径的初始化
     */
    var fileMap = distrbute(opts),
        rjsMap = fileMap.rjs,
        cssMap = fileMap.css,
        jsMap = fileMap.js,
        imageMap = fileMap.image,
        scssMap = fileMap.scss,
        watchTask = function () {

            var cache = [], running = false;

            listener(opts, function (file, extname, type) {

                function go(file, extname, type) {

                    function next() {
                        if (cache.length != 0) {
                            go.apply(this, cache.shift());
                        } else {
                            running = false;
                        }
                    }

                    switch (extname) {
                        case 'rjs':
                            if (type == 'change' || type == 'built') {
                                walk(getArgs(file, {}, type), libraryMap, opts, function () {
                                    if (type == 'built') {
                                        util.log(file, type);
                                    } else {
                                        trace.log(file[0] + ' has been changed at ' + new Date());
                                    }
                                    next();
                                });
                            } else if (!type) {
                                walk(getArgs(getRJSFiles(file), {}, type), libraryMap, opts, function () {
                                    trace.log('mod file: ' + file + ' has been changed at ' + new Date());
                                });
                                next();
                            } else if (type == 'libFile') {
                                walk(rjsMap, libraryMap, opts);
                                next();
                            } else if (type == 'removed') {
                                rjsMap = getArgs(file, rjsMap, type);
                                util.log(file, type);
                                next();
                            } else {
                                file = PATH.normalize(PATH.resolve(file));
                                if (type === 'resetLibA') {
                                    libraryMap.indexOf(file) === -1 && libraryMap.push(file);
                                }
                                else if (type === 'resetLibD') {
                                    libraryMap = util.removeEle.call(libraryMap, file);
                                }
                            }
                            break;
                        case 'css':
                            if (type == 'change') {
                                doMinify(getArgs(file, cssMap, type), opts, 'css');
                                trace.log(file[0] + ' has been changed at ' + new Date());
                            } else if (type == 'removed' || type == 'built') {
                                cssMap = getArgs(file, cssMap, type);
                                util.log(file, type);
                            }
                            next();
                            break;
                        case 'js':
                            if (type == 'change') {
                                doMinify(getArgs(file, {}, type), opts, 'js');
                                trace.log(file[0] + ' has been changed at ' + new Date());
                            } else if (type == 'removed' || type == 'built') {
                                jsMap = getArgs(file, jsMap, type);
                                util.log(file, type);
                            }
                            next();
                            break;
                        case 'scss':
                            if (type == 'change') {
                                doMinify(getArgs(file, scssMap, type), opts, 'scss');
                                trace.log(file[0] + ' has been changed at ' + new Date());
                            } else if (type == 'remove' || type == 'built') {
                                scssMap = getArgs(file, scssMap, type);
                                util.log(file, type);
                            }
                            next();
                            break;
                        case '' :
                            break;
                        default :
                            if (opts.image.patterns.indexOf('.' + extname) != -1) {
                                imin(getArgs(file), opts);
                                trace.log(file[0] + ' has been changed at ' + new Date());
                            }
                            next();
                    }
                }

                if (!running) {
                    running = true;
                    go(file, extname, type);
                } else {
                    cache.push(arguments);
                }
            });
        },
        task_run = function () {
            //对CSS文件的处理
            if (cssMap) {
                doMinify(cssMap, opts, 'css');
                trace.ok('CSS file processing tasks completed\n');
            }

            if (scssMap) {
                doMinify(scssMap, opts, 'scss');
                trace.ok('scss file processing tasks completed\n');
            }

            if (jsMap) {
                doMinify(jsMap, opts, 'js');
                trace.ok('JS file processing tasks completed\n');
            }

            if (imageMap) {
                imin(imageMap, opts, function () {
                    trace.ok('image compress tasks completed\n');
                    //watch任务处理
                    opts.watch && watchTask();
                });
            } else {
                opts.watch && watchTask();
            }
        };

    trace.load('\ntask run, go...\n');

    /*
     * 因为rjs任务为异步操作
     * 所以放在最先执行的位置上
     */
    if (util.getLength(fileMap) !== 0) {
        if (util.getLength(rjsMap) !== 0) {
            //获取库文件的映射列表
            if (opts.rjs && opts.rjs.libraryPath) {
                libraryMap = getLibraryMap(PATH.resolve(opts.rjs.libraryPath) + PATH.sep, [PATH.resolve(opts.inputPath) + PATH.sep]);
            }
            walk(rjsMap, libraryMap, opts, function () {
                trace.ok('RJS file processing tasks completed\n');
                task_run();
            });
        } else {
            task_run();
        }
    } else {
        trace.warn('no file to be processed , process end');
    }
};
