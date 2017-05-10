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

    const isLibFile = (file) => opts.rjs && opts.rjs.libraryPath && isInDirectory(file, opts.rjs.libraryPath);

    //监听文件的规则
    const rule = (file = '') => {

        let $extname = extname(file);

        if (isLibFile(file))  return false;

        if (($extname === '.js' && opts.js) || ((testRJS(file) || testModJS(file)) && opts.rjs) || $extname === '' || ($extname === '.css' && opts.css) || (testSCSS(file) && opts.scss) || (opts.image && opts.image.patterns.indexOf($extname) !== -1)) {
            return true;
        }

        return false;
    };

    //处理逻辑
    const handle = (file, curr, pre) => {

        if (typeof file == "object" && pre === null && curr === null) return false;

        let $extname = extname(file).replace(/\./, '');

        //对文件夹修改的响应，后续更新......
        if ($extname === '') return false;

        if (pre === null) {
            //延迟处理批量增加
            cb && cb([file, $extname, 'built']);
        } else if (curr.nlink === 0) {
            //延迟处理批量删除
            cb && cb([file, $extname, 'removed']);
        } else {
            cb && cb([file, $extname, 'change']);
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