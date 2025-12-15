const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const { spawn } = require('child_process');
const path = require('path');

// 动态导入 open 模块
let open;
import('open').then(module => {
    open = module.default;
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 全局变量追踪进程状态
let syncProcess = null;

io.on('connection', (socket) => {
    console.log('前端页面已连接');

    // 如果当前有正在运行的任务，通知前端
    if (syncProcess) {
        socket.emit('status', 'running');
    }

    // 监听前端的开始指令
    socket.emit('log', '准备就绪，点击按钮开始同步...');

    socket.on('start-sync', () => {
        if (syncProcess) {
            socket.emit('log', '⚠️ 任务正在运行中，请勿重复启动。');
            return;
        }

        console.log('收到启动指令，正在启动 index.js...');
        
        // 使用 spawn 启动 node index.js
        // 注意：cwd 设置为当前目录，确保能读取 .env
        const nodePath = process.execPath; // 获取当前 node 可执行文件路径
        syncProcess = spawn(nodePath, ['index.js'], {
            cwd: __dirname,
            env: process.env, // 继承当前环境变量
            stdio: ['ignore', 'pipe', 'pipe'] // 忽略 stdin, 捕获 stdout 和 stderr
        });

        // 监听标准输出 (日志)
        syncProcess.stdout.on('data', (data) => {
            const output = data.toString();
            // 实时发送给前端
            process.stdout.write(output); // 同时也输出到当前控制台
            socket.emit('log', output);
        });

        // 监听标准错误 (错误日志)
        syncProcess.stderr.on('data', (data) => {
            const output = data.toString();
            console.error(output);
            socket.emit('error-log', output);
        });

        // 监听进程退出
        syncProcess.on('close', (code) => {
            console.log(`子进程退出，退出码 ${code}`);
            socket.emit('process-exit', code);
            syncProcess = null;
        });

        // 监听进程错误
        syncProcess.on('error', (err) => {
            console.error('启动子进程失败:', err);
            socket.emit('error-log', `启动失败: ${err.message}`);
            syncProcess = null;
        });
    });
});

server.listen(PORT, async () => {
    console.log(`🌐 服务已启动: http://localhost:${PORT}`);
    console.log('🚀 正在自动打开浏览器...');
    
    // 自动打开浏览器 (确保 open 模块已加载)
    if (open) {
        await open(`http://localhost:${PORT}`);
    } else {
        // 如果 open 还没加载完，稍等一下再试
        setTimeout(async () => {
             if (open) await open(`http://localhost:${PORT}`);
        }, 1000);
    }
});
