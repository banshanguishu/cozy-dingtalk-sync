const { run } = require('./index');

// 配置同步间隔 (默认 10 分钟)
const SYNC_INTERVAL = (process.env.SYNC_INTERVAL_MINUTES || 10) * 60 * 1000;

const TYPES_TO_SYNC = ['drapery', 'roman_shade'];

async function startScheduler() {    
    console.log(`⏰ 启动自动同步调度器，间隔: ${SYNC_INTERVAL / 1000 / 60} 分钟`);

    const runSync = async () => {
        console.log(`\n[${new Date().toISOString()}] 开始执行同步轮询...`);
        for (const type of TYPES_TO_SYNC) {
            try {
                console.log(`--> 正在同步: ${type}`);
                await run(type);
                console.log(`<-- 完成同步: ${type}`);
            } catch (error) {
                console.error(`❌ 同步 ${type} 失败:`, error);
            }
        }
        console.log(`[${new Date().toISOString()}] 本次轮询结束，等待下一次...`);
    };

    // 立即执行一次
    await runSync();

    // 定时执行
    setInterval(runSync, SYNC_INTERVAL);
}

startScheduler();
