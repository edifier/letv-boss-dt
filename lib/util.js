/**
 * Created by wangxin8 on 2015/10/27.
 */
'use strict';
var PATH = require('path');
var trace = require('./trace.js');

module.exports = {

    /*
     * @author wangxin
     * 获取对象长度
     * return number;
     */
    getLength: function () {
        var i = 0, o = arguments[0];
        for (var j in o) {
            if (typeof o[j] === 'object') {
                i += this.getLength(o[j]);
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
    forEach: function (handle) {
        var arr = this, len = arr.length;
        for (var i = 0; i < len; i++) {
            if (handle(arr[i], i) === false) break;
        }
    },

    /*
     * @author wangxin
     * 深度复制，按条件赋值
     * return object;
     */
    extendDeep: function (parent) {
        var i,
            toStr = Object.prototype.toString,
            astr = '[object Array]',
            child = arguments[1] || {},
            dirName = arguments[2] || null;
        for (i in parent) {
            if (parent.hasOwnProperty(i)) {
                if (typeof parent[i] === "object") {
                    child[i] = (toStr.call(parent[i]) === astr) ? [] : {};
                    this.extendDeep(parent[i], child[i], dirName);
                } else {
                    if (dirName) {
                        if (/path/gi.test(i)) parent[i] = this.relative(dirName, parent[i]);
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
    relative: function (basePath, outPath) {
        var symbol = PATH.sep, dirArr = outPath.replace(/(\\|\/)/g, symbol).split(symbol), $p;

        switch (dirArr[0]) {
            case '.':
                $p = (PATH.extname(basePath) !== '' ? PATH.join(PATH.dirname(basePath), outPath) : PATH.join(basePath, outPath));
                break;
            case '' :
                $p = outPath;
                break;
            case '..':
                var baseArr = basePath.split(symbol);
                this.forEach.call(dirArr, function (dir, i) {
                    if (dir === '..') {
                        baseArr.pop();
                    } else {
                        $p = PATH.join(baseArr.join(symbol), dirArr.slice(i).join(symbol));
                        return false;
                    }
                });
                break;
            default :
                $p = PATH.join(basePath, outPath);
        }
        return $p;
    },

    isInDirectory: function () {
        var dirPath = PATH.normalize(PATH.resolve(arguments[1])),
            filePath = PATH.normalize(PATH.resolve(arguments[0])).split(PATH.sep);

        var is = true;

        this.forEach.call(dirPath.split(PATH.sep), function (dir, i) {
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
    testRJS: function (file) {
        return /.+\/rjs\/\w+\.js/gi.test(file.replace(/\\/gi, '/')) || /.+_rjs\.js/gi.test(PATH.basename(file));
    },

    /*
     * @author wangxin
     * 校验文件是否是SCSS文件
     * file: 文件路径
     * return boolean;
     */
    testSCSS:function(file){
        return /.*\/scss\/.*\.scss/gi.test(file.replace(/\\/gi, '/'));
    },

    /*
     * @author wangxin
     * 删除数组元素
     * ele: 要删除的元素
     * return array;
     */
    removeEle: function (ele) {
        var arr = this, a = [],
            i = 0,
            len = arr.length;
        for (; i < len; i++) {
            if (arr[i] != ele) a.push(arr[i]);
        }
        return a;
    },

    /*
     * @author wangxin
     * 循环输出文件修改
     * file: 文件路径数组
     * msg： 信息
     */
    log: function (file, msg) {
        for (var i = 0, len = file.length; i < len; i++) {
            trace.log(file[i] + ' : has been ' + msg);
        }
    }
};