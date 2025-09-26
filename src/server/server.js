const net = require('net');
const db = require('./database');

/**
 * @description 存储所有当前在线的客户端socket连接
 * @type {Map<number, net.Socket>} - Key: 客户端数据库ID, Value: Socket对象
 */
const clients = new Map();

/**
 * 启动TCP服务器，监听客户端连接
 * @param {import('electron').BrowserWindow} mainWindow - Electron的主窗口实例，用于IPC通信
 */
function startServer(mainWindow) {
    const server = net.createServer((socket) => {
        const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`新客户端连接: ${remoteAddress}`);

        // 处理从客户端收到的数据
        socket.on('data', async (data) => {
            const message = data.toString().trim();
            
            console.log(`从 ${remoteAddress} 收到原始数据: "${message}"`);

            if (message.includes('|')) {
                let [hostname, mac] = message.split('|');
                
                if (mac.includes('HEARTBEAT')) {
                    mac = mac.replace('HEARTBEAT', '').trim();
                    console.log(`检测到粘包，清洗后的MAC地址: ${mac}`);
                }

                try {
                    const client = await db.addOrUpdateClient({ hostname, mac, ip: socket.remoteAddress.replace('::ffff:', '') });
                    clients.set(client.id, socket);
                    mainWindow.webContents.send('client-status-change', { ...client, status: 'online', ip: socket.remoteAddress.replace('::ffff:', '') });
                    console.log(`客户端 ${client.hostname} (${client.mac}) 已认证并上线。`);
                } catch (err) {
                    console.error('处理客户端认证时出错:', err);
                }

            } else if (message.includes('HEARTBEAT')) {
                // 收到独立的心跳包
            }
        });

        // 处理客户端断开连接事件
        socket.on('close', () => {
            for (const [id, clientSocket] of clients.entries()) {
                if (clientSocket === socket) {
                    clients.delete(id);
                    mainWindow.webContents.send('client-status-change', { id, status: 'offline' });
                    console.log(`客户端 ID ${id} 已断开连接。`);
                    break;
                }
            }
            console.log(`连接已关闭: ${remoteAddress}`);
        });

        socket.on('error', (err) => {
            console.error(`Socket错误来自 ${remoteAddress}: ${err.message}`);
        });
    });

    server.listen(9999, '0.0.0.0', () => {
        console.log('服务端已在端口 9999 上启动');
    });

    server.on('error', (err) => {
        console.error('服务端错误:', err);
    });
}

/**
 * 向指定的在线客户端发送命令
 * @param {number} clientId - 客户端的数据库ID
 * @param {string} command - 要发送的命令
 * @returns {boolean} - 命令是否发送成功
 */
function sendCommandToClient(clientId, command) {
    const socket = clients.get(clientId);
    if (socket && socket.writable) {
        console.log(`向客户端 ID:${clientId} 发送命令: ${command}`);
        socket.write(command);
        return true;
    }
    console.log(`无法向客户端 ID:${clientId} 发送命令，客户端可能已离线。`);
    return false;
}

// 导出模块函数
module.exports = {
    startServer,
    sendCommandToClient,
    getOnlineClientIds: () => Array.from(clients.keys()),
};