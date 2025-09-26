const { contextBridge, ipcRenderer } = require('electron');

// --- 主应用API ---
// 使用 contextBridge 在主世界(前端页面)暴露一个名为 'api' 的全局对象
contextBridge.exposeInMainWorld('api', {

    // --- 监听事件 ---
    onClientStatusChange: (callback) => ipcRenderer.on('client-status-change', (_event, value) => callback(value)),
    
    // --- 客户端相关API ---
    getAllClients: () => ipcRenderer.invoke('clients:getAll'),
    getOnlineIds: () => ipcRenderer.invoke('clients:getOnlineIds'),
    updateClientDetails: (details) => ipcRenderer.invoke('clients:updateDetails', details),
    deleteClient: (id) => ipcRenderer.invoke('clients:delete', id),
    wakeClient: (mac) => ipcRenderer.invoke('clients:wake', mac),
    sendCommand: (details) => ipcRenderer.invoke('clients:sendCommand', details),

    // --- 分组相关API ---
    getAllGroups: () => ipcRenderer.invoke('groups:getAll'),
    createGroup: (name, description) => ipcRenderer.invoke('groups:create', name, description),
    deleteGroup: (id) => ipcRenderer.invoke('groups:delete', id),

    // --- 任务相关API ---
    getPendingTasks: () => ipcRenderer.invoke('tasks:getPending'),
    createTask: (task) => ipcRenderer.invoke('tasks:create', task),
    deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id),

    // --- 一键操作API ---
    executeBulkAction: (details) => ipcRenderer.invoke('bulk:execute', details),
});


// --- 窗口控制API ---
// 专门为无边框窗口的自定义按钮暴露控制函数
contextBridge.exposeInMainWorld('controls', {
    minimize: () => ipcRenderer.send('window-controls:minimize'),
    maximize: () => ipcRenderer.send('window-controls:maximize'),
    close: () => ipcRenderer.send('window-controls:close'),
});