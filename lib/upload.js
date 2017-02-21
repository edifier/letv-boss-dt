const fs = require('fs');
const PATH = require('path');
const readline = require('readline');

const Client = require('ssh2').Client;

const trace = require('./trace.js');
const util = require('./util.js');


const config = {
    cwd: 'diff.log',
    userInfo: {
        name: "root",
        password: "d7PGxcf3bhx9YoZJpGFm"
    },
    ftp: {
        host: '10.154.250.38',
        port: 22,
        basePath: '/data/static/pay/'
    }
};

const go = (files = [], i) => {

    let len = files.length;

    const upload = (localfile, remoteFile) => {
        let c = new Client();

        c.on('ready', function () {
            c.sftp(function (err, sftp) {
                if (err) throw err;
                sftp.fastPut(localfile.replace(/\\/g, '/'), remoteFile.replace(/\\/g, '/'), function (err) {
                    if (err) throw err;
                    c.end();
                    trace.ok(localfile + ' :上传完成！');
                    go(files, ++i);
                });
            });
        });

        c.connect({
            host: config.ftp.host,
            port: config.ftp.port,
            username: config.userInfo.name,
            password: config.userInfo.password
        });
    };

    if (i < len) {
        let file = files[i],
            extname = PATH.extname(file),
            dir = extname == '.js' ? '/js/' : '/css/';
        upload(util.relative(process.cwd() + dir, file).replace(/\\/g, '/'), util.relative(config.ftp.basePath + dir, file).replace(/\\/g, '/'));
    } else {
        trace.ok('全部文件上传完毕!\n');
        process.exit(1);
    }
};

module.exports = (type) => {

    let cwd, files = [];

    if (!type) {
        filePaths = fs.readFileSync(util.relative(process.cwd(), config.cwd), 'utf-8').split('\n');

        util.forEach.call(filePaths, function (file) {
            if (file) {
                let path = util.relative(process.cwd(), '../' + file);
                fs.existsSync(path) && files.push(PATH.basename(path));
            }
        });
    } else {
        if (type == 'js') {
            cwd = 'js/';
        } else if (type == 'css') {
            cwd = 'css/';
        }

        try {
            files = fs.readdirSync(util.relative(process.cwd(), cwd));
        } catch (e) {
            trace.error('上传任务需要输入一个路径');
            process.exit(1);
        }
    }

    if (files.length === 0) {
        trace.log('没有需要上传的文件，进程结束');
        process.exit(1);
    }

    trace.load('\n上线文件清单 : ');
    trace.ok(files.join('\n'));
    trace.log('\n');

    process.stdin.setEncoding('utf8');
    let rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('你确定上传以上文件吗？(Y/N)', (data) => {

        data = data.trim();
        rl.close();

        if (data == 'Y') {
            go(files, 0);
        } else {
            process.exit(0);
        }
    });
};