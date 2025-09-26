const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const wol = require('wol');

// 导入我们自己的模块
const { startServer, getOnlineClientIds, sendCommandToClient } = require('./server/server');
const { startTaskManager } = require('./server/taskManager');
const db = require('./server/database');
const { sendWakeOnLan } = require('./server/wolManager');

// --- 核心修复：在启动时初始化数据库 ---
// 获取Electron为应用分配的、可写的用户数据目录
const userDataPath = app.getPath('userData');
// 定义数据库文件的完整路径
const dbPath = path.join(userDataPath, 'clients.db');
// 使用此路径初始化数据库模块
db.initializeDatabase(dbPath);
// --- 修复结束 ---


// 主窗口的全局引用，以防止被垃圾回收
let mainWindow;

/**
 * 创建并加载应用主窗口
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 940,
        minHeight: 600,
        // --- 实现无边框窗口 ---
        frame: false,
        titleBarStyle: 'hidden',
        // --- 修改结束 ---
        webPreferences: {
            // 预加载脚本是连接前端和后端的安全桥梁
            preload: path.join(__dirname, 'preload.js'),
            // 启用上下文隔离，增强安全性
            contextIsolation: true,
            // 禁用Node.js集成，增强安全性
            nodeIntegration: false,
        },
        icon: path.join(__dirname, '../assets/icon.ico'), // 可选：设置应用图标
        title: "远程管理服务端"
    });

    // 加载UI界面 (index.html)
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // 打开开发者工具 (用于调试, 正式发布时可注释掉)
    // mainWindow.webContents.openDevTools();
}

// 当Electron初始化完成后，创建窗口并启动服务
app.whenReady().then(() => {
    createWindow();

    // 启动TCP服务器，并传入主窗口实例以便通信
    startServer(mainWindow);

    // 启动定时任务管理器
    startTaskManager();

    // macOS特有的激活窗口逻辑
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 当所有窗口关闭时退出应用 (Windows & Linux)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


// --- IPC (Inter-Process Communication) ---
// 此处处理所有来自前端(Renderer Process)的请求

// --- 窗口控制相关 (使用 .on 因为它们不需要返回值) ---
ipcMain.on('window-controls:minimize', () => mainWindow.minimize());
ipcMain.on('window-controls:maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});
ipcMain.on('window-controls:close', () => mainWindow.close());


// --- 客户端相关 (使用 .handle 因为它们需要异步返回数据) ---
ipcMain.handle('clients:getAll', () => db.getAllClients());
ipcMain.handle('clients:getOnlineIds', () => getOnlineClientIds());
ipcMain.handle('clients:updateDetails', (event, { id, name, groupId }) => db.updateClientDetails(id, name, groupId));
ipcMain.handle('clients:delete', (event, id) => db.deleteClient(id));
ipcMain.handle('clients:wake', async (event, mac) => {
    try {
        const client = await db.getClientByMac(mac);
        const ip = client ? client.ip : null;
        return await sendWakeOnLan(mac, ip);
    } catch (dbError) {
        console.error(`从数据库查询MAC ${mac} 时出错:`, dbError);
        return await sendWakeOnLan(mac, null);
    }
});
ipcMain.handle('clients:sendCommand', (event, { clientId, command }) => {
    const success = sendCommandToClient(clientId, command);
    return { success };
});

// --- 分组相关 ---
ipcMain.handle('groups:getAll', () => db.getAllGroups());
ipcMain.handle('groups:create', (event, name, description) => db.createGroup(name, description));
ipcMain.handle('groups:delete', (event, id) => db.deleteGroup(id));


// --- 任务相关 ---
ipcMain.handle('tasks:getPending', () => db.getPendingTasks());
ipcMain.handle('tasks:create', (event, task) => db.createTask(task));
ipcMain.handle('tasks:delete', (event, id) => db.deleteTask(id));


// --- 一键操作相关 ---
ipcMain.handle('bulk:execute', async (event, { action, targetType, targetId }) => {
    let clientsToProcess = [];
    const summary = { attempted: 0, online: 0, offline: 0, action };

    // 1. 根据目标类型获取客户端列表
    if (targetType === 'all') {
        clientsToProcess = await db.getAllClients();
    } else if (targetType === 'group' && targetId) {
        clientsToProcess = await db.getClientsByGroupId(targetId);
    }
    summary.attempted = clientsToProcess.length;

    const onlineIds = getOnlineClientIds();

    // 2. 遍历列表并执行操作
    for (const client of clientsToProcess) {
        if (action === 'wake') {
            if (client.mac) {
                sendWakeOnLan(client.mac, client.ip);
            }
        } else { // 'shutdown' 或 'reboot'
            if (onlineIds.includes(client.id)) {
                const command = `${action.toUpperCase()} 0`; // 立即执行
                sendCommandToClient(client.id, command);
                summary.online++;
            } else {
                summary.offline++;
            }
        }
    }
    return summary;
});