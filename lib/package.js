/**
 * Created by wangxin on 17/4/23.
 * 打包压缩并获取文件依赖关系
 */
const mdeps = require('module-deps');
const JSONStream = require('JSONStream');
const browserPack = require('browser-pack');

const {extendDeep, notEmpty} = require('./util.js');

class Package {

    constructor(files, opts, mdopts) {
        //文件地址
        this.files = files;

        //对象参数
        this.opts = extendDeep({}, opts);

        //模块解析参数
        this.mdopts = extendDeep({}, mdopts);

        //配置依赖树的数据
        this.depencyData = [];

        //模块打包使用的数据
        this.packData = [];

        //成功回调函数集合
        this.callbacks = [];

        //错误回调函数集合
        this.errorcallbacks = [];

        //配置依赖关系树的回调函数集合
        this.depency_tree_callbacks = [];

        //模块解析对象，静态属性
        this.md = mdeps(this.mdopts);

        //模块打包对象，静态属性
        this.bpack = browserPack({row: true});
    }

    doPackage() {
        let jobileName = '', index = 0, map = {};

        this.md.on('data', (pack) => {
            if (pack.entry) jobileName = pack.id;
            this.depencyData.push(pack);

            let easyPack = extendDeep(pack), {id, deps} = easyPack;

            if (map[id]) {
                easyPack.id = map[id];
            } else {
                easyPack.id = ++index;
                map[id] = easyPack.id;
            }
            if (notEmpty(deps)) {
                for (let i in deps) {
                    if (map[deps[i]]) {
                        deps[i] = map[deps[i]];
                    } else {
                        deps[i] = ++index;
                        map[deps[i]] = deps[i];
                    }
                }
            }
            this.packData.push(easyPack);
        }).on('end', () => {
            let content = [];

            this.bpack.on('data', (buff) => {
                content.push(buff.toString('utf8'));
            }).on('end', () => {
                //文件合并完成后的回调
                this.then.call(this, content.join(''));
                //配置依赖关系树的回调
                this.set_depency_tree.call(this, this.depencyData, jobileName);
            }).on('error', (e) => {
                this.errors.call(this, new Error(e));
            });

            this.bpack.end(JSON.stringify(this.packData));
        }).on('error', (e) => {
            this.errors.call(this, new Error(e));
        });

        this.md.pipe(JSONStream.stringify());
        this.md.end({file: this.files});

        return this;
    }

    then(fn) {
        if (!fn) {
            throw 'then method need a parameter';
        } else if (typeof fn === 'function') {
            this.callbacks.push(fn);
        } else if (typeof fn === 'string') {
            while (this.callbacks.length !== 0) {
                this.callbacks.shift().call(this, fn);
            }
        }
        return this;
    }

    errors(fn) {
        if (!fn) {
            throw 'errors method need a parameter';
        } else if (typeof fn === 'function') {
            this.errorcallbacks.push(fn);
        } else if (typeof fn === 'object') {
            while (this.errorcallbacks.length !== 0) {
                this.errorcallbacks.shift().call(this, fn);
            }
            this.callbacks = [];
        }
        return this;
    }

    set_depency_tree(fn, fileName) {
        if (!fn) {
            throw 'set_depency_tree method need a parameter';
        } else if (typeof fn === 'function') {
            this.depency_tree_callbacks.push(fn);
        } else if (typeof fn === 'object') {
            while (this.depency_tree_callbacks.length !== 0) {
                this.depency_tree_callbacks.shift().call(this, fn, fileName);
            }
        }
        return this;
    }
}

module.exports = Package;