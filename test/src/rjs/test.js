/**
 * Created by wangxin on 15/10/3.
 */

//库文件方法的引用
var clear = require('clear.js');
//node模块的引用
var PATH = require('path');
//工程文件的引用
var t2 = require('./t2');

console.log(clear([1, null, '']));
console.log(PATH);
t2();