/**
 * Created by wangxin8 on 2015/10/21.
 * watch任务
 */

'use strict';
const PATH = require('path');

const watch = require('watch');

const trace = require('./trace.js');
const util = require('./util.js');

const listener = (opts = {}, cb = () => {}) => {

    //判断是否是mod类型文件
    const checkModFile = (file) => /.+\/rjs\/mod\/\w+\.js/gi.test(file.replace(/\\/gi, '/'));

    //监听文件的规则
    const rule = (file = '') => {

        let extname = PATH.extname(file);

        if (opts.rjs && opts.rjs.libraryPath && util.isInDirectory(file, opts.rjs.libraryPath))  return false;

        if ((extname === '.js' && opts.js) || (util.testRJS(file) && opts.rjs) || extname === '' || (extname === '.css' && opts.css) || (util.testSCSS(file) && opts.scss) || (opts.image && opts.image.patterns.indexOf(extname) !== -1) || checkModFile(file)) {
            return true;
        }

        return false;
    };

    //处理逻辑
    const handle = (file, curr, pre) => {

        function delay() {
            let that = this;
            this.timer && clearTimeout(this.timer);
            this.cacheArr.indexOf(file) === -1 && this.cacheArr.push(file);

            this.timer = setTimeout(function () {
                that.callback && that.callback(that.cacheArr);
            }, 50);
        }

        function getObjectMod(type) {
            return new Object({
                timer: null,
                cacheArr: [],
                callback: function (path) {
                    cb && cb(path, util.testRJS(file) ? 'rjs' : extname, type);
                }
            });
        }

        if (typeof file == "object" && pre === null && curr === null) {
            trace.ok('watch task has been started...\n');
            return false;
        }

        let extname = PATH.extname(file).replace(/\./, ''),
            isModFile = checkModFile(file),
            isRjsFile = (isModFile || util.testRJS(file));

        if (pre === null) {
            //将文件名重命名为rjs文件夹的响应，waiting....
            //延迟处理批量增加
            !isModFile && extname != '' && delay.call(getObjectMod('built'));
        } else if (curr.nlink === 0) {
            //延迟处理批量删除
            !isModFile && extname != '' && delay.call(getObjectMod('removed'));
        } else {
            cb && cb([file], isRjsFile ? 'rjs' : extname, isModFile ? undefined : 'change');
        }
    };

    //执行监听
    watch.watchTree(opts.inputPath, {
        filter: rule,
        interval: opts.watch.interval || 1200
    }, handle);

    //库文件的监听
    if (opts.rjs && opts.rjs.libraryPath) {
        watch.watchTree(opts.rjs.libraryPath, {
                filter: (file) => PATH.extname(file) == '.js' || PATH.extname(file) == '',
                interval: opts.watch.interval || 1200
            },
            (file, curr, pre) => {
                if (typeof file != "object" || pre !== null || curr !== null) {
                    if (pre === null) {
                        if (PATH.extname(file) == '') {
                            cb && cb(file, 'rjs', 'resetLibA');
                        } else {
                            cb && cb([], 'rjs', 'libFile');
                        }
                    } else if (curr.nlink === 0) {
                        cb && cb(file, 'rjs', 'resetLibD');
                    } else {
                        cb && cb([], 'rjs', 'libFile');
                    }
                    trace.log('library file changed at ' + new Date());
                }
            }
        );
    }
};

module.exports = listener;