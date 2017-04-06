/**
 * Created by wangxin on 15/10/3.
 */

'use strict';
const {readdirSync, lstatSync, readFileSync} = require('fs');
const {resolve, dirname, sep, normalize} = require('path');
const {decode} = require('iconv-lite');

const browserify = require('browserify');
const Imagemin = require('imagemin');

const distrbute = require('./lib/distrbute');
const {error, ok, warn, log, load}  = require('./lib/trace');
const outputHandle = require('./lib/output');
const listener = require('./lib/listener');
const {
    getLength,
    log:util_log,
    removeEle,
    extendDeep,
    forEach,
    testRJS
} = require('./lib/util');

/*
 * @author wangxin
 * 获取执行任务的参数
 * file: 文件路径
 * return object;
 */
const getArgs = (file = '', o = {}, type = '') => {
    let path = resolve(file);
    if (!type || type == 'built' || type == 'change') {
        !o[path] && (o[path] = file);
    } else if (type === 'removed') {
        delete o[path];
    }
    return o;
};

/*
 * @author wangxin
 * 获取一个mod文件父文件夹下的RJS文件
 * return arr ['dirPath','dirPath',...]
 */
const getRJSFiles = (files = []) => {
    if (files.length == 0) return [];

    let arr = [],
        rjsDirectory = files[0].replace(/mod[\/\\].+$/g, ''),
        rjsFiles = readdirSync(rjsDirectory);

    forEach(rjsFiles, function (fileName) {
        let file = rjsDirectory + fileName;
        testRJS(file) && arr.push(file);
    });

    return arr;
};

/*
 * @author wangxin
 * 获取一个文件下所有文件路径
 * return arr ['dirPath','dirPath',...]
 */
const getLibraryMap = (fileDir = '', arr = []) => {
    let files = readdirSync(fileDir);
    forEach(files, function (fileName) {
        let baseDir = fileDir + fileName, lstat = lstatSync(baseDir);
        if (lstat.isDirectory()) {
            getLibraryMap(baseDir + sep, arr);
        } else {
            let file = dirname(baseDir);
            arr.indexOf(file) === -1 && arr.push(normalize(file));
        }
    });
    return arr;
};

/*
 * @author wangxin
 * 进行browserify编译
 * content: 文件内容，string;
 * outputPath: 输出文件路径
 * return;
 */
const doBrowserify = (basePath, libraryMap, config, index, cb) => {
    let b = new browserify({
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
            error(String(err));
        } else {
            //browserify编译完成，开始输出
            outputHandle(decode(code, 'utf8'), basePath, config, 'rjs');
            cb && cb(index + 1);
        }
    });
};

/*
 * @author wangxin
 * 处理加载模块文件内容为路径名
 * rjsMap: rjs文件map对象
 * libraryMap: 库文件map对象
 * return false;
 */
const walk = (rjsMap, libraryMap, opt, cb) => {

    let arr = [], go = (i) => {
        if (arr[i]) {
            doBrowserify(arr[i], libraryMap, opt, i, go);
        } else {
            cb && cb();
        }
        return false;
    };

    for (let i in rjsMap) {
        if (!i) {
            error('file error');
            break;
        }
        if (rjsMap.hasOwnProperty(i)) arr.push(rjsMap[i]);
    }

    //开始编译
    return go(0);
};

/*
 * @author wangxin
 * 文件压缩==>js、css文件
 * opts: 输出路径：文件路径
 * retrun；
 */
const doMinify = (map, opts, type) => {
    for (let i in map) {
        let con = readFileSync(map[i]), charset = '';
        //这里不建议用gbk编码格式
        if (decode(con, 'gbk').indexOf('�') != -1) {
            charset = 'utf8';
        } else {
            charset = 'gbk';
        }

        outputHandle(decode(con, charset), map[i], opts, type);
        con = null;
    }
};

/*
 * @author wangxin
 * 压缩图片
 * opts: 输出路径：文件路径
 * retrun；
 */
const imin = (map, opts, cb) => {
    let arr = [];
    for (let i in map) arr.push(map[i]);

    load('image compressed, waiting...');

    ~function () {
        if (opts.image && opts.image.output && opts.image.output.path) {
            new Imagemin().src(arr).dest(normalize(opts.image.output.path)).run(function () {
                cb && cb()
            });
        } else {
            error('Image output object requires a path attribute');
        }
    }();
};

/*
 * @author wangxin
 * 初始化方法
 * opts: 配置参数
 * 详情参考 ../test/test.js ==> config
 */
module.exports = function (config) {

    let opts = extendDeep(config);

    let libraryMap = [];

    /**
     * 文件路径的初始化
     */
    let fileMap = distrbute(opts), {
        rjs:rjsMap,
        css:cssMap,
        js:jsMap,
        image:imageMap,
        scss:scssMap
    } = fileMap;

    const watchTask = () => {

        let cache = [], running = false;

        listener(opts, (args = []) => {

            const go = (file, extname, type) => {

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
                            util_log(file, type);
                            walk(getArgs(file, {}, type), libraryMap, opts, function () {
                                next();
                            });
                        } else if (!type) {
                            log('mod file: ' + file + ' has been changed at ' + new Date());
                            walk(getArgs(getRJSFiles(file), {}, type), libraryMap, opts, function () {
                                next();
                            });
                        } else if (type == 'libFile') {
                            walk(rjsMap, libraryMap, opts);
                            next();
                        } else if (type == 'removed') {
                            util_log(file, type);
                            rjsMap = getArgs(file, rjsMap, type);
                            next();
                        } else {
                            file = normalize(resolve(file));
                            if (type === 'resetLibA') {
                                libraryMap.indexOf(file) === -1 && libraryMap.push(file);
                            }
                            else if (type === 'resetLibD') {
                                libraryMap = removeEle.call(libraryMap, file);
                            }
                        }
                        break;
                    case 'css':
                        if (type == 'change') {
                            doMinify(getArgs(file, cssMap, type), opts, 'css');
                            util_log(file, type);
                        } else if (type == 'removed' || type == 'built') {
                            cssMap = getArgs(file, cssMap, type);
                            util_log(file, type);
                        }
                        next();
                        break;
                    case 'js':
                        if (type == 'change') {
                            doMinify(getArgs(file, {}, type), opts, 'js');
                            util_log(file, type);
                        } else if (type == 'removed' || type == 'built') {
                            jsMap = getArgs(file, jsMap, type);
                            util_log(file, type);
                        }
                        next();
                        break;
                    case 'scss':
                        if (type == 'change') {
                            doMinify(getArgs(file, scssMap, type), opts, 'scss');
                            util_log(file, type);
                        } else if (type == 'remove' || type == 'built') {
                            scssMap = getArgs(file, scssMap, type);
                            util_log(file, type);
                        }
                        next();
                        break;
                    default :
                        // log('>>> Debugging information, you can ignore: ' + extname + '\n');
                        if (opts.image && opts.image.patternss && opts.image.patterns.indexOf('.' + extname) != -1) {
                            imin(getArgs(file), opts);
                            util_log(file, type);
                        }
                        next();
                }
            };

            cache = cache.concat(args);

            if (!running) {
                running = true;
                go.apply(this, cache.shift());
            } else {
                cache.push(args);
            }
        });
    };

    const task_run = function () {
        //对CSS文件的处理
        if (cssMap) {
            doMinify(cssMap, opts, 'css');
            ok('CSS file processing tasks completed\n');
        }

        if (scssMap) {
            doMinify(scssMap, opts, 'scss');
            ok('scss file processing tasks completed\n');
        }

        if (jsMap) {
            doMinify(jsMap, opts, 'js');
            ok('JS file processing tasks completed\n');
        }

        if (imageMap) {
            imin(imageMap, opts, function () {
                ok('image compress tasks completed\n');
                //watch任务处理
                opts.watch && watchTask();
            });
        } else {
            opts.watch && watchTask();
        }
    };

    load('\ntask run, go...\n');

    /*
     * 因为rjs任务为异步操作
     * 所以放在最先执行的位置上
     */
    if (getLength(fileMap) !== 0) {
        if (getLength(rjsMap) !== 0) {
            //获取库文件的映射列表
            if (opts.rjs && opts.rjs.libraryPath) {
                libraryMap = getLibraryMap(resolve(opts.rjs.libraryPath) + sep, [resolve(opts.inputPath) + sep]);
            }
            walk(rjsMap, libraryMap, opts, () => {
                ok('RJS file processing tasks completed\n');
                task_run();
            });
        } else {
            task_run();
        }
    } else {
        warn('no file to be processed , process end');
    }
};
