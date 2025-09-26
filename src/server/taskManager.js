const db = require('./database');
const { sendCommandToClient } = require('./server');
const { sendWakeOnLan } = require('./wolManager');
const cronParser = require('cron-parser');

// 定义检查任务的频率（毫秒），例如每15秒
const CHECK_INTERVAL = 15000;

/**
 * 启动任务管理器，定期检查并执行到期的任务
 */
function startTaskManager() {
    console.log('任务管理器已启动。');
    setInterval(checkAndExecuteTasks, CHECK_INTERVAL);
}

/**
 * 检查数据库中的待处理任务并执行它们
 */
async function checkAndExecuteTasks() {
    try {
        const pendingTasks = await db.getPendingTasks();
        const now = new Date();

        for (const task of pendingTasks) {
            const executionTime = new Date(task.execution_time);

            // 检查任务是否到期
            if (now >= executionTime) {
                console.log(`执行任务 ID: ${task.id}, 类型: ${task.task_type}`);
                await executeTask(task);

                // --- 核心逻辑：处理循环任务 ---
                if (task.recurrence_rule && task.recurrence_rule !== 'once') {
                    try {
                        // 使用 cron-parser 解析规则并计算下一次执行时间
                        const interval = cronParser.parseExpression(task.recurrence_rule, { currentDate: executionTime });
                        const nextRunTime = interval.next().toISOString();
                        
                        console.log(`任务 ${task.id} 是循环任务, 下次执行时间更新为: ${nextRunTime}`);
                        await db.updateTaskNextRun(task.id, nextRunTime);
                    } catch (err) {
                        console.error(`解析Cron表达式失败 for task ${task.id}:`, err);
                        // 如果规则错误，将任务标记为失败以防止无限循环错误
                        await db.updateTaskStatus(task.id, 'failed');
                    }
                } else {
                    // 如果是“仅一次”的任务，则标记为“完成”
                    await db.updateTaskStatus(task.id, 'completed');
                }
            }
        }
    } catch (err) {
        console.error('检查并执行任务时出错:', err);
    }
}

/**
 * 根据任务类型执行具体操作 (关机、重启、唤醒)
 * @param {object} task - 数据库中的任务对象
 */
async function executeTask(task) {
    // 目前所有任务都只支持分组作为目标
    if (task.target_type !== 'group') {
        console.log(`任务 ${task.id} 的目标类型不受支持: ${task.target_type}`);
        return;
    }

    try {
        const clientsInGroup = await db.getClientsByGroupId(task.target_id);
        
        if (task.task_type === 'shutdown' || task.task_type === 'reboot') {
            const delay = task.delay_seconds || 0; // 使用任务中设定的延迟时间
            const command = `${task.task_type.toUpperCase()} ${delay}`;
            console.log(`向分组 ${task.target_id} 中的 ${clientsInGroup.length} 个客户端发送命令: ${command}`);
            clientsInGroup.forEach(client => {
                sendCommandToClient(client.id, command);
            });
        } else if (task.task_type === 'wake') {
            console.log(`向分组 ${task.target_id} 中的 ${clientsInGroup.length} 个客户端发送唤醒信号`);
            clientsInGroup.forEach(client => {
                if (client.mac) {
                    sendWakeOnLan(client.mac, client.ip);
                }
            });
        }
    } catch (err) {
        console.error(`执行任务 ${task.id} 时获取客户端列表失败:`, err);
    }
}

module.exports = { startTaskManager };