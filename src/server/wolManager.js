const wol = require('wol');

/**
 * 向指定的MAC地址发送网络唤醒（Magic Packet）信号
 * @param {string} macAddress - 目标客户端的MAC地址
 * @param {string|null} targetIp - 目标客户端最后一次记录的IP地址，用于计算子网广播地址
 * @returns {Promise<{success: boolean, error?: string}>} - 操作结果
 */
function sendWakeOnLan(macAddress, targetIp = null) {
    return new Promise((resolve) => {
        if (!macAddress) {
            return resolve({ success: false, error: '未提供MAC地址。' });
        }

        const options = {};
        // 如果提供了IP地址，则计算子网广播地址
        if (targetIp) {
            try {
                const ipParts = targetIp.split('.');
                if (ipParts.length === 4) {
                    ipParts[3] = '255';
                    options.address = ipParts.join('.');
                    console.log(`根据IP ${targetIp} 计算出子网广播地址: ${options.address}`);
                } else {
                    console.warn(`无效的IP地址格式: ${targetIp}，将使用默认广播。`);
                }
            } catch (e) {
                console.error('计算广播地址失败，将使用默认广播。');
            }
        }

        wol.wake(macAddress, options, (err) => {
            if (err) {
                console.error(`唤醒 ${macAddress} 失败:`, err);
                resolve({ success: false, error: err.message });
            } else {
                console.log(`已向 ${macAddress} 发送唤醒信号 (目标: ${options.address || '默认'})`);
                resolve({ success: true });
            }
        });
    });
}

module.exports = {
    sendWakeOnLan,
};