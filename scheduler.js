const { run } = require("./index");

// 同步间隔（默认 10 分钟）
const SYNC_INTERVAL = Number(process.env.SYNC_INTERVAL_MINUTES || 10) * 60 * 1000;

async function startScheduler() {
  console.log(`⏰ 启动自动同步调度器，统一间隔 ${SYNC_INTERVAL / 1000 / 60} 分钟`);

  const runSync = async () => {
    console.log(`\n\n[${new Date().toISOString()}] 开始执行同步轮询...`);
    try {
      await run();
    } catch (error) {
      console.error("❌ 普通订单同步任务失败:", error);
    }
    try {
      await run("refund");
    } catch (error) {
      console.error("❌ refund 同步任务失败:", error);
    }
    console.log(`[${new Date().toISOString()}] 本次轮询结束，等待下一次...`);
  };

  await runSync();

  setInterval(runSync, SYNC_INTERVAL);
}

startScheduler().catch((error) => {
  console.error("❌ 调度器启动失败", error.message);
  process.exit(1);
});
