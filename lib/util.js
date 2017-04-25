/**
 * Created by wangxin8 on 2015/10/27.
 */
'use strict';
const {
    sep,
    extname,
    join,
    dirname,
    normalize,
    resolve,
    basename
} = require('path');
const {log} = require('./trace.js');

const util = {

    /*
     * @author wangxin
     * 获取对象长度
     * return number;
     */
    getLength: (o = {}) => {
        let i = 0;
        for (let j in o) {
            if (typeof o[j] === 'object') {
                i += util.getLength(o[j]);
            } else {
                (o.hasOwnProperty(j) && o[j]) && i++;
            }
        }
        return i;
    },

    /*
     * 替换forEach功能
     * ES5的forEach不支持break
     */
    forEach: (arr = [], handle) => {
        let len = arr.length;
        for (let i = 0; i < len; i++) {
            if (handle(arr[i], i) === false) break;
        }
    },

    /*
     * @author wangxin
     * 深度复制，按条件赋值
     * return object;
     */
    extendDeep: (parent, child = {}, dirName = null) => {
        let i, toStr = Object.prototype.toString, astr = '[object Array]';
        for (i in parent) {
            if (parent.hasOwnProperty(i)) {
                if (typeof parent[i] === "object") {
                    child[i] = (toStr.call(parent[i]) === astr) ? [] : {};
                    util.extendDeep(parent[i], child[i], dirName);
                } else {
                    if (dirName) {
                        if (/path/gi.test(i)) parent[i] = util.relative(dirName, parent[i]);
                    } else {
                        if (/path/gi.test(i) && !/^.+\/$/.test(parent[i])) parent[i] += '/';
                    }
                    child[i] = parent[i];
                }
            }
        }
        return child;
    },

    /*
     * 获取文件路径方法
     * basePath是A文件绝对路径，outPath是B相对A的相对路径
     * return string: B的绝对路径
     */
    relative: (basePath = '', outPath = '') => {
        let symbol = sep, dirArr = outPath.replace(/(\\|\/)/g, symbol).split(symbol), $p;

        switch (dirArr[0]) {
            case '.':
                $p = (extname(basePath) !== '' ? join(dirname(basePath), outPath) : join(basePath, outPath));
                break;
            case '' :
                $p = outPath;
                break;
            case '..':
                let baseArr = basePath.split(symbol);
                util.forEach(dirArr, function (dir, i) {
                    if (dir === '..') {
                        baseArr.pop();
                    } else {
                        $p = join(baseArr.join(symbol), dirArr.slice(i).join(symbol));
                        return false;
                    }
                });
                break;
            default :
                $p = join(basePath, outPath);
        }
        return $p;
    },

    isInDirectory: (...arg) => {
        let dirPath = normalize(resolve(arg[1])),
            filePath = normalize(resolve(arg[0])).split(sep);

        let is = true;

        util.forEach(dirPath.split(sep), function (dir, i) {
            if (dir != filePath[i]) {
                is = false;
                return false;
            }
        });

        return is;
    },

    /*
     * @author wangxin
     * 校验文件是否是rjs文件
     * file: 文件路径
     * return boolean;
     */
    testRJS: (file = '') => /.+\/rjs\/[^\/]+\.js/gi.test(file.replace(/\\/gi, '/')) || /.+_rjs\.js/gi.test(basename(file)),

    /*
     * @author wangxin
     * 校验文件是否是模块文件
     * file: 文件路径
     * return boolean;
     */
    testModJS: (file = '') => /.+\/rjs\/.+\/[^\/]+\.js/gi.test(file.replace(/\\/gi, '/')),

    /*
     * @author wangxin
     * 校验文件是否是SCSS文件
     * file: 文件路径
     * return boolean;
     */
    testSCSS: (file = '') => /.*\/scss\/.*\.scss/gi.test(file.replace(/\\/gi, '/')),

    /*
     * @author wangxin
     * 删除数组元素
     * ele: 要删除的元素
     * return array;
     */
    removeEle: (arr = [], ele) => {
        let a = [], i = 0, len = arr.length;
        for (; i < len; i++) {
            if (arr[i] !== ele) a.push(arr[i]);
        }
        return a;
    },

    /*
     * @author wangxin
     * 循环输出文件修改
     * file: 文件路径数组
     * msg： 信息
     */
    log: (file, msg = '') => log(file + '\n' + msg + ' at ' + new Date().toString().substring(0, 24) + '\n'),

    /*
     * 判断对象不为空
     * return boolean;
     */
    notEmpty: (o) => {
        if (typeof o !== 'object') return false;
        for (let i in o) return true;
        return false;
    }
};

module.exports = util;