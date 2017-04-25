/**
 * Created by wangxin8 on 2015/10/21.
 * watch任务
 */

'use strict';
const {extname} = require('path');

const {watchTree} = require('watch');

const {ok} = require('./trace.js');
const {isInDirectory, testRJS, testSCSS, testModJS} = require('./util.js');

const listener = (opts = {}, cb = () => {}) => {

    let cache = {};

    //监听文件的规则
    const rule = (file = '') => {

        let $extname = extname(file);

        if (opts.rjs && opts.rjs.libraryPath && isInDirectory(file, opts.rjs.libraryPath))  return false;

        if (($extname === '.js' && opts.js) || ((testRJS(file) || testModJS(file)) && opts.rjs) || $extname === '' || ($extname === '.css' && opts.css) || (testSCSS(file) && opts.scss) || (opts.image && opts.image.patterns.indexOf($extname) !== -1)) {
            return true;
        }

        return false;
    };

    //处理逻辑
    const handle = (file, curr, pre) => {

        if (typeof file == "object" && pre === null && curr === null) return false;

        let $extname = extname(file).replace(/\./, '');

        //将文件名重命名为rjs文件夹的响应，waiting....
        if ($extname === '') return false;

        const getObjectMod = () => {
            return new Object({
                timer: null,
                cacheArr: [],
            });
        };

        function delay(callback, ...args) {
            let that = this;
            this.timer && clearTimeout(this.timer);
            this.cacheArr.indexOf(file) === -1 && this.cacheArr.push(args);

            this.timer = setTimeout(function () {
                callback && callback(that.cacheArr);
                that.timer = null;
                that.cacheArr = [];
            }, 50);
        }

        const go = (type, callback, ...args) => {
            if (!cache[type]) cache[type] = getObjectMod();
            args.push(type);
            delay.call(cache[type], (paths) => callback && callback(paths), ...args);
        };

        if (pre === null) {
            //延迟处理批量增加
            go('built', (paths) => cb && cb(paths), file, $extname);
        } else if (curr.nlink === 0) {
            //延迟处理批量删除
            go('removed', (paths) => cb && cb(paths), file, $extname);
        } else {
            go('change', (paths) => cb && cb(paths), file, $extname);
        }
    };

    //执行监听
    watchTree(opts.inputPath, {
        filter: rule,
        interval: opts.watch.interval || 1200
    }, handle);

    //库文件的监听
    if (opts.rjs && opts.rjs.libraryPath) {
        watchTree(opts.rjs.libraryPath, {
            filter: (file) => extname(file) == '.js' || extname(file) == '',
            interval: opts.watch.interval || 1200
        }, handle);
    }

    ok('watch task has been started...\n');
};

module.exports = listener;