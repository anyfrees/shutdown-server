const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 将db提升为模块级变量，它将由 main.js 传入路径后进行初始化
let db;

/**
 * 初始化数据库连接。
 * 这个函数必须由 main.js 调用，并传入一个可写的数据库文件路径。
 * @param {string} dbPath - 数据库文件的绝对路径
 */
function initializeDatabase(dbPath) {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('打开数据库时出错:', err.message);
        } else {
            console.log(`成功连接到SQLite数据库，路径: ${dbPath}`);
            // 开启外键约束支持，这对于维护数据完整性很重要
            db.exec('PRAGMA foreign_keys = ON;', (err) => {
                if (err) console.error("无法开启外键约束:", err);
            });
            // 初始化数据库表结构
            initializeDbSchema();
        }
    });
}

/**
 * 初始化数据库，确保所有表和列都存在。
 */
function initializeDbSchema() {
    db.serialize(() => {
        // 1. 创建 groups 表 (必须在 clients 之前创建，因为有外键关联)
        db.run(`CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT
        )`);
        
        // 2. 创建 clients 表，包含所有字段和外键
        // ON DELETE SET NULL 表示如果一个分组被删除，该分组下的客户端 group_id 会被设为 NULL (未分组)
        db.run(`CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hostname TEXT NOT NULL,
            mac TEXT NOT NULL UNIQUE,
            ip TEXT,
            name TEXT,
            group_id INTEGER,
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
        )`);
        
        // 3. 创建 tasks 表 (包含 recurrence_rule 和 delay_seconds 字段)
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_type TEXT NOT NULL,
            execution_time TEXT NOT NULL,
            recurrence_rule TEXT,
            delay_seconds INTEGER DEFAULT 0,
            target_type TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
        )`);
    });
}


// --- 客户端 (Client) 相关函数 ---

function addOrUpdateClient({ hostname, mac, ip }) {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        const findQuery = `SELECT * FROM clients WHERE mac = ?`;

        db.get(findQuery, [mac], (err, row) => {
            if (err) return reject(err);

            if (row) {
                // 客户端已存在，更新IP和最后上线时间
                const updateQuery = `UPDATE clients SET ip = ?, last_seen = ? WHERE id = ?`;
                db.run(updateQuery, [ip, now, row.id], function (err) {
                    if (err) return reject(err);
                    resolve({ ...row, ip, last_seen: now });
                });
            } else {
                // 新客户端，插入新记录
                const insertQuery = `INSERT INTO clients (hostname, mac, ip, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)`;
                db.run(insertQuery, [hostname, mac, ip, now, now], function (err) {
                    if (err) return reject(err);
                    resolve({ id: this.lastID, hostname, mac, ip, name: null, group_id: null, first_seen: now, last_seen: now });
                });
            }
        });
    });
}

function getAllClients() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM clients ORDER BY last_seen DESC`, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function updateClientDetails(id, name, groupId) {
    return new Promise((resolve, reject) => {
        const query = `UPDATE clients SET name = ?, group_id = ? WHERE id = ?`;
        db.run(query, [name, groupId, id], function (err) {
            if (err) return reject(err);
            resolve({ changes: this.changes });
        });
    });
}

function getClientsByGroupId(groupId) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM clients WHERE group_id = ?`, [groupId], (err, rows) => {
            if(err) return reject(err);
            resolve(rows);
        });
    });
}

const deleteClient = (id) => new Promise((resolve, reject) => {
    db.run(`DELETE FROM clients WHERE id = ?`, [id], function(err) {
        if(err) return reject(err);
        resolve({ changes: this.changes });
    });
});

function getClientByMac(mac) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM clients WHERE mac = ?`, [mac], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}


// --- 分组 (Group) 相关函数 ---

const createGroup = (name, description) => new Promise((resolve, reject) => {
    db.run(`INSERT INTO groups (name, description) VALUES (?, ?)`, [name, description], function(err) {
        if(err) return reject(err);
        resolve({ id: this.lastID, name, description });
    });
});

const getAllGroups = () => new Promise((resolve, reject) => {
    db.all(`SELECT * FROM groups ORDER BY name`, [], (err, rows) => {
        if(err) return reject(err);
        resolve(rows);
    });
});

const deleteGroup = (id) => new Promise((resolve, reject) => {
    db.run(`DELETE FROM groups WHERE id = ?`, [id], function(err) {
        if(err) return reject(err);
        resolve({ changes: this.changes });
    });
});


// --- 任务 (Task) 相关函数 ---

const createTask = ({ taskType, executionTime, recurrenceRule, delaySeconds, targetType, targetId }) => new Promise((resolve, reject) => {
    db.run(`INSERT INTO tasks (task_type, execution_time, recurrence_rule, delay_seconds, target_type, target_id) VALUES (?, ?, ?, ?, ?, ?)`, 
        [taskType, executionTime, recurrenceRule, delaySeconds, targetType, targetId], function(err) {
        if(err) return reject(err);
        resolve({ id: this.lastID });
    });
});

const getPendingTasks = () => new Promise((resolve, reject) => {
    db.all(`SELECT * FROM tasks WHERE status = 'pending' ORDER BY execution_time`, [], (err, rows) => {
        if(err) return reject(err);
        resolve(rows);
    });
});

const deleteTask = (id) => new Promise((resolve, reject) => {
    db.run(`DELETE FROM tasks WHERE id = ?`, [id], function(err) {
        if(err) return reject(err);
        resolve({ changes: this.changes });
    });
});

const updateTaskStatus = (id, status) => new Promise((resolve, reject) => {
    db.run(`UPDATE tasks SET status = ? WHERE id = ?`, [status, id], function(err) {
        if(err) return reject(err);
        resolve({ changes: this.changes });
    });
});

const updateTaskNextRun = (id, nextRunTime) => new Promise((resolve, reject) => {
    db.run(`UPDATE tasks SET execution_time = ? WHERE id = ?`, [nextRunTime, id], function(err) {
        if(err) return reject(err);
        resolve({ changes: this.changes });
    });
});


// 导出所有需要被外部调用的函数
module.exports = {
    initializeDatabase, // 导出新的初始化函数
    // Client Functions
    addOrUpdateClient,
    getAllClients,
    updateClientDetails,
    getClientsByGroupId,
    deleteClient,
    getClientByMac,
    // Group Functions
    createGroup,
    getAllGroups,
    deleteGroup,
    // Task Functions
    createTask,
    getPendingTasks,
    deleteTask,
    updateTaskStatus,
    updateTaskNextRun,
};