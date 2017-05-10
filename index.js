/**
 * Created by wangxin on 15/10/3.
 */

'use strict';
const {readdirSync, lstatSync, readFileSync} = require('fs');
const {resolve, dirname, sep, normalize} = require('path');
const {decode} = require('iconv-lite');

const Imagemin = require('imagemin');
const {createInterface} = require('readline');

const Package = require('./lib/package.js');
const distrbute = require('./lib/distrbute');
const {error, ok, warn, load}  = require('./lib/trace');
const outputHandle = require('./lib/output');
const listener = require('./lib/listener');
const {
    getLength,
    log:util_log,
    removeEle,
    extendDeep,
    forEach,
    testRJS,
    notEmpty,
    testModJS,
    isInDirectory
} = require('./lib/util');

//打包的实例对象
let myPackage = null;

//依赖关系树
let depency_tree = {
    job: {},
    mod: {},
    lib: {}
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
    myPackage = new Package(basePath, {}, {
        paths: libraryMap,
        debug: config.rjs.debug || false
    });

    myPackage.doPackage().then((code) => {
        outputHandle(code, basePath, config, 'rjs');
        cb && cb(index + 1);
    }).errors((err) => {
        module.timer && clearTimeout(module.timer);
        module.timer = setTimeout(function () {
            module.timer && clearTimeout(module.timer);
            module.timer = null;
            cb && cb(index + 1);
        }, 50);
        error('\n' + String(err) + '\n');
    }).set_depency_tree((map, jobFileName) => {
        let {job, mod, lib} = depency_tree;

        const setDT = (item) => {
            for (let i in item.deps) {
                let fileName = item.deps[i];
                if (isInDirectory(fileName, config.rjs.libraryPath)) {
                    //是library类型的模块文件
                    if (!lib[fileName]) lib[fileName] = {name: fileName, job: []};
                    lib[fileName].job.indexOf(jobFileName) === -1 && lib[fileName].job.push(jobFileName);
                } else {
                    //普通模块文件
                    if (!mod[fileName]) mod[fileName] = {name: fileName, job: []};
                    mod[fileName].job.indexOf(jobFileName) === -1 && mod[fileName].job.push(jobFileName);
                }
                if (job[jobFileName]) {
                    if (!job[jobFileName].deps) job[jobFileName].deps = [];
                    job[jobFileName].deps.indexOf(fileName) === -1 && job[jobFileName].deps.push(fileName);
                }
            }
        };

        forEach(map, (item) => {
            let fileID = item.id;
            if (job[fileID] && fileID === jobFileName) {
                if (item.entry && typeof item.deps === 'object') {
                    setDT(item);
                }
            } else if (notEmpty(item.deps)) {
                setDT(item);
            }
        });
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

    let arr = [];

    const go = (i) => {
        if (arr[i]) {
            doBrowserify(arr[i], libraryMap, opt, i, go);
        } else {
            cb && cb();
        }
        return false;
    };

    if (rjsMap instanceof Object) {
        for (let i in rjsMap) {
            if (!i) {
                error('file error');
                break;
            }
            if (rjsMap.hasOwnProperty(i)) arr.push(rjsMap[i]);
        }
    } else if (rjsMap instanceof Array) {
        arr = arr.concat(rjsMap);
    } else if (typeof rjsMap === 'string') {
        arr.push(rjsMap);
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

    const go = (file) => {
        let con = readFileSync(file), charset = '';
        //这里不建议用gbk编码格式
        if (decode(con, 'gbk').indexOf('�') != -1) {
            charset = 'utf8';
        } else {
            charset = 'gbk';
        }

        outputHandle(decode(con, charset), file, opts, type);
    };

    if (typeof map === 'string') {
        go(map);
    } else if (map instanceof Object) {
        for (let i in map) {
            go(map[i]);
        }
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

    if (typeof map === 'string') {
        arr.push(map);
    } else {
        for (let i in map) arr.push(map[i]);
    }

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

                let {job, mod, lib} = depency_tree;

                function next() {
                    if (cache.length != 0) {
                        go.apply(this, cache.shift());
                    } else {
                        running = false;
                    }
                }

                switch (extname) {
                    case 'js':
                        if (opts.rjs && (job[file] || testRJS(file))) {
                            if (type === 'change') {
                                walk(file, libraryMap, opts, () => {
                                    util_log(file, type);
                                    next();
                                });
                            } else if (type === 'built') {
                                walk(file, libraryMap, opts, () => {
                                    util_log(file, type);
                                    next();
                                });
                            } else if (type === 'removed') {
                                job[file] && job[file].deps && forEach(job[file].deps, (item) => {
                                    if (mod[item]) mod[item].job = removeEle(mod[item].job, file);
                                    if (lib[item]) lib[item].job = removeEle(lib[item].job, file);
                                });
                                delete job[file];
                                util_log(file, type);
                                next();
                            }
                        } else if (opts.rjs && (mod[file] || testModJS(file))) {
                            if (type === 'change') {
                                if (mod[file] && mod[file].job && mod[file].job.length != 0) {
                                    walk(mod[file].job, libraryMap, opts, () => {
                                        util_log(mod[file].job, type);
                                        next();
                                    });
                                } else {
                                    util_log(file, type);
                                    next();
                                }
                            } else if (type === 'removed') {
                                util_log(file, type);
                                lib[file] && lib[file].job && forEach(mod[file].job, (item) => {
                                    job[item].deps = removeEle(job[item].deps, file);
                                });
                                delete mod[file];
                                next();
                            } else if (type === 'built') {
                                util_log(file, type);
                                mod[file] = {name: file, job: []};
                                next();
                            }
                        } else if (opts.rjs && (lib[file] || isInDirectory(file, opts.rjs.libraryPath))) {
                            if (type === 'change') {
                                if (lib[file] && lib[file].job && lib[file].job.length != 0) {
                                    walk(lib[file].job, libraryMap, opts, () => {
                                        util_log(lib[file].job, type);
                                        next();
                                    });
                                } else {
                                    util_log(file, type);
                                    next();
                                }
                            } else if (type === 'removed') {
                                util_log(file, type);
                                lib[file] && lib[file].job && forEach(lib[file].job, (item) => {
                                    job[item].deps = removeEle(job[item].deps, file);
                                });
                                delete lib[file];
                                next();
                            } else if (type === 'built') {
                                util_log(file, type);
                                lib[file] = {name: file, job: []};
                                file = normalize(resolve(file));
                                next();
                            }
                        } else {
                            util_log(file, type);
                            if (type === 'change') {
                                doMinify(file, opts, 'js');
                            } else if (type === 'built') {
                                jsMap[file] = file;
                            } else if (type === 'removed') {
                                delete jsMap[file];
                            }
                            next();
                        }
                        break;
                    case 'css':
                        util_log(file, type);
                        if (type === 'change') {
                            doMinify(cssMap, opts, 'css');
                        } else if (type === 'built') {
                            cssMap[file] = file;
                        } else if (type === 'removed') {
                            delete cssMap[file];
                        }
                        next();
                        break;
                    case 'scss':
                        util_log(file, type);
                        if (type === 'change') {
                            doMinify(scssMap, opts, 'scss');
                        } else if (type === 'built') {
                            scssMap[file] = file;
                        } else if (type === 'remove') {
                            delete scssMap[file];
                        }
                        next();
                        break;
                    default :
                        if (opts.image && opts.image.patternss && opts.image.patterns.indexOf('.' + extname) != -1) {
                            imin(file, opts);
                            util_log(file, type);
                        }
                        next();
                }
            };

            cache.push(args);

            if (!running) {
                running = true;
                try {
                    go.apply(this, cache.shift());
                } catch (e) {
                    error(String(e));
                }
            } else {
                cache.push(args);
            }
        });
    };

    const task_run = function () {
        if (jsMap) {
            doMinify(jsMap, opts, 'js');
            ok('JS file processing tasks completed\n');
        }

        if (cssMap) {
            doMinify(cssMap, opts, 'css');
            ok('CSS file processing tasks completed\n');
        }

        if (scssMap) {
            doMinify(scssMap, opts, 'scss');
            ok('scss file processing tasks completed\n');
        }

        if (imageMap) {
            imin(imageMap, opts, function () {
                ok('image compress tasks completed\n');
                //watch任务处理
                opts.watch && watchTask();
            });
        }

        if (opts.watch) watchTask();

    };

    const begin = () => {
        load('\ntask run, go...\n');
        walk(rjsMap, libraryMap, opts, () => {
            ok('RJS file processing tasks completed\n');
            task_run();
        });
    };

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
            //初始化rjs依赖树
            for (let i in rjsMap) {
                let job = depency_tree.job;
                if (!job[i]) {
                    job[i] = {name: i};
                }
            }
            //文件名重复的处理
            if (fileMap.duplicateFile) {
                process.stdin.setEncoding('utf8');
                let rl = createInterface({
                    input: process.stdin,
                    output: process.stdout
                });

                rl.question('\n存在重复名称文件，可能造成修改被覆盖，是否继续(Y/N)', (data) => {
                    data = data.trim();
                    rl.close();

                    if (data == 'N') {
                        process.exit(0);
                    } else {
                        begin();
                    }
                });
            } else {
                begin();
            }
        } else {
            task_run();
        }
    } else {
        warn('no file to be processed , process end');
    }
};