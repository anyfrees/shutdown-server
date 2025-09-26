document.addEventListener('DOMContentLoaded', () => {
    // --- 1. 全局状态管理 ---
    const state = {
        clients: {},
        groups: [],
        tasks: [],
        clientViewMode: localStorage.getItem('clientViewMode') || 'card',
    };

    // --- 2. DOM 元素缓存 ---
    const clientCardViewDiv = document.getElementById('client-card-view');
    const clientListViewDiv = document.getElementById('client-list-view');
    const clientTableBody = document.getElementById('client-table-body');
    const groupListDiv = document.getElementById('group-list');
    const taskListDiv = document.getElementById('task-list');
    const views = document.querySelectorAll('.view-content');
    const navItems = document.querySelectorAll('.nav-item');
    const body = document.querySelector('body');
    const viewCardBtn = document.getElementById('view-card-btn');
    const viewListBtn = document.getElementById('view-list-btn');

    // --- 3. 渲染函数 ---

    const renderAll = () => {
        renderClients();
        renderGroups();
        renderTasks();
    };

    const renderClients = () => {
        if (state.clientViewMode === 'card') {
            renderClientCards();
        } else {
            renderClientList();
        }
    };

    const renderClientCards = () => {
        clientCardViewDiv.innerHTML = '';
        const sortedClients = Object.values(state.clients).sort((a, b) => (a.name || a.hostname).localeCompare(b.name || b.hostname));
        sortedClients.forEach(client => {
            const group = state.groups.find(g => g.id === client.group_id);
            const isOnline = client.status === 'online';
            const statusColor = isOnline ? 'bg-green-500' : 'bg-gray-500';
            const card = document.createElement('div');
            card.className = `relative bg-gray-800 p-4 rounded-lg shadow-lg border-l-4 ${isOnline ? 'border-green-500' : 'border-gray-500'} transition-transform transform hover:scale-105`;

            let actionButtonsHTML = '';
            if (isOnline) {
                actionButtonsHTML = `
                    <div class="action-menu-container absolute top-2 right-2">
                        <button data-id="${client.id}" class="toggle-action-menu w-6 h-6 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full flex items-center justify-center">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                        </button>
                        <div class="action-menu hidden absolute right-0 mt-2 w-40 bg-gray-700 rounded-md shadow-lg z-20">
                            <a href="#" data-id="${client.id}" class="edit-client-btn block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600">编辑</a>
                            <a href="#" data-id="${client.id}" data-action="shutdown" class="send-command-btn block px-4 py-2 text-sm text-red-400 hover:bg-gray-600">关机</a>
                            <a href="#" data-id="${client.id}" data-action="reboot" class="send-command-btn block px-4 py-2 text-sm text-yellow-400 hover:bg-gray-600">重启</a>
                        </div>
                    </div>
                `;
            } else {
                actionButtonsHTML = `
                    <div class="absolute top-2 right-2 flex space-x-1">
                        <button data-mac="${client.mac}" class="wake-client-btn w-6 h-6 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center" title="唤醒">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </button>
                        <button data-id="${client.id}" class="delete-client-btn w-6 h-6 text-gray-400 hover:text-white hover:bg-red-600 rounded-full flex items-center justify-center text-lg" title="删除">✕</button>
                    </div>
                `;
            }

            card.innerHTML = `
                ${actionButtonsHTML}
                <div class="${isOnline ? 'cursor-pointer' : ''}">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="font-bold text-lg truncate pr-8">${client.name || client.hostname}</h3>
                        <span class="w-4 h-4 ${statusColor} rounded-full flex-shrink-0" title="${isOnline ? '在线' : '离线'}"></span>
                    </div>
                    <p class="text-sm text-gray-400">分组: ${group?.name || '未分组'}</p>
                    <p class="text-sm text-gray-400">${isOnline ? client.ip : '离线'}</p>
                    <p class="text-xs text-gray-500 mt-2">${client.mac}</p>
                </div>
            `;
            if (isOnline) {
                card.querySelector('.cursor-pointer').addEventListener('click', () => showClientEditModal(client));
            }
            clientCardViewDiv.appendChild(card);
        });
    };

    const renderClientList = () => {
        clientTableBody.innerHTML = '';
        const sortedClients = Object.values(state.clients).sort((a, b) => (a.name || a.hostname).localeCompare(b.name || b.hostname));
        sortedClients.forEach(client => {
            const group = state.groups.find(g => g.id === client.group_id);
            const isOnline = client.status === 'online';
            const statusColor = isOnline ? 'bg-green-500' : 'bg-gray-500';
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-700/50';

            let actionButtonsHTML = '';
            if (isOnline) {
                actionButtonsHTML = `
                    <div class="action-menu-container relative inline-block text-left">
                        <button data-id="${client.id}" class="toggle-action-menu inline-flex justify-center w-full rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-800 text-sm font-medium text-gray-300 hover:bg-gray-700">
                            操作
                            <svg class="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                        </button>
                        <div class="action-menu hidden origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-20">
                            <div class="py-1">
                                <a href="#" data-id="${client.id}" class="edit-client-btn block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600">编辑</a>
                                <a href="#" data-id="${client.id}" data-action="shutdown" class="send-command-btn block px-4 py-2 text-sm text-red-400 hover:bg-gray-600">关机</a>
                                <a href="#" data-id="${client.id}" data-action="reboot" class="send-command-btn block px-4 py-2 text-sm text-yellow-400 hover:bg-gray-600">重启</a>
                            </div>
                        </div>
                    </div>`;
            } else {
                actionButtonsHTML = `
                    <button data-mac="${client.mac}" class="wake-client-btn bg-blue-600 hover:bg-blue-700 text-xs px-2 py-1 rounded">唤醒</button>
                    <button data-id="${client.id}" class="delete-client-btn text-gray-400 hover:text-white text-xs px-2 py-1 rounded">删除</button>
                `;
            }

            row.innerHTML = `
                <td class="p-4"><span class="w-3 h-3 ${statusColor} rounded-full inline-block" title="${isOnline ? '在线' : '离线'}"></span></td>
                <td class="p-4 font-semibold text-white">${client.name || 'N/A'}</td>
                <td class="p-4 text-gray-400">${group?.name || '未分组'}</td>
                <td class="p-4 text-gray-400">${isOnline ? client.ip : '离线'}</td>
                <td class="p-4 text-gray-400 truncate max-w-xs">${client.hostname}</td>
                <td class="p-4 text-gray-400">${client.mac}</td>
                <td class="p-4 text-right space-x-2">${actionButtonsHTML}</td>
            `;
            clientTableBody.appendChild(row);
        });
    };
    
    const renderGroups = () => {
        groupListDiv.innerHTML = '';
        state.groups.forEach(group => {
            const groupEl = document.createElement('div');
            groupEl.className = 'bg-gray-800 p-4 rounded-lg flex justify-between items-center';
            groupEl.innerHTML = `<div><h3 class="font-bold text-lg">${group.name}</h3><p class="text-sm text-gray-400">${group.description || '没有描述'}</p></div><button data-id="${group.id}" class="delete-group-btn bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm">删除</button>`;
            groupListDiv.appendChild(groupEl);
        });
        document.querySelectorAll('.delete-group-btn').forEach(btn => btn.addEventListener('click', handleDeleteGroup));
    };
    
    const renderTasks = () => {
        taskListDiv.innerHTML = '';
        state.tasks.forEach(task => {
             const group = state.groups.find(g => g.id === task.target_id);
             const targetName = group ? group.name : '未知分组';
             const taskEl = document.createElement('div');
             taskEl.className = 'bg-gray-800 p-4 rounded-lg flex justify-between items-center';
             taskEl.innerHTML = `
                <div>
                    <h3 class="font-bold text-lg">${task.task_type === 'shutdown' ? '定时关机' : (task.task_type === 'reboot' ? '定时重启' : '定时唤醒')} - 目标: ${targetName}</h3>
                    <p class="text-sm text-gray-400">下次执行: ${new Date(task.execution_time).toLocaleString()}</p>
                    <p class="text-xs text-gray-500 mt-1">规则: ${task.recurrence_rule === 'once' ? '仅一次' : task.recurrence_rule}</p>
                </div>
                <button data-id="${task.id}" class="delete-task-btn bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm">取消</button>
             `;
             taskListDiv.appendChild(taskEl);
        });
        document.querySelectorAll('.delete-task-btn').forEach(btn => btn.addEventListener('click', handleDeleteTask));
    };

    // --- 4. 视图切换和导航逻辑 ---
    const updateClientView = () => {
        if (state.clientViewMode === 'card') {
            clientCardViewDiv.classList.remove('hidden');
            clientListViewDiv.classList.add('hidden');
            viewCardBtn.classList.add('bg-gray-600');
            viewListBtn.classList.remove('bg-gray-600');
        } else {
            clientCardViewDiv.classList.add('hidden');
            clientListViewDiv.classList.remove('hidden');
            viewCardBtn.classList.remove('bg-gray-600');
            viewListBtn.classList.add('bg-gray-600');
        }
        renderClients();
    };

    viewCardBtn.addEventListener('click', () => { state.clientViewMode = 'card'; localStorage.setItem('clientViewMode', 'card'); updateClientView(); });
    viewListBtn.addEventListener('click', () => { state.clientViewMode = 'list'; localStorage.setItem('clientViewMode', 'list'); updateClientView(); });
    const handleNavigation = (hash) => {
        const viewId = (hash || '#clients').replace('#', '');
        views.forEach(v => v.classList.add('hidden'));
        const activeView = document.getElementById(`${viewId}-view`);
        if (activeView) activeView.classList.remove('hidden');
        navItems.forEach(item => { item.classList.remove('bg-gray-700'); if (item.getAttribute('href') === (hash || '#clients')) { item.classList.add('bg-gray-700'); } });
    };

    // --- 5. 模态框和事件处理器 ---
    const showModal = (title, content) => {
        const modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50';
        modalBackdrop.innerHTML = `<div class="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl"><h2 class="text-2xl font-bold mb-4">${title}</h2>${content}</div>`;
        modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) modalBackdrop.remove(); });
        body.appendChild(modalBackdrop);
        return modalBackdrop;
    };
    
    const showSendCommandModal = (client, action) => {
        const actionText = action === 'shutdown' ? '关机' : '重启';
        const modal = showModal(`向 ${client.name || client.hostname} 发送命令`, `
            <form id="send-command-form" class="space-y-4">
                <div><label class="block mb-2 text-sm font-bold text-gray-400">操作类型</label><input type="text" value="${actionText}" class="w-full bg-gray-700 p-2 rounded" readonly></div>
                <div><label class="block mb-2 text-sm font-bold text-gray-400">延迟时间 (秒)</label><input type="number" name="delay" value="0" min="0" class="w-full bg-gray-700 p-2 rounded"></div>
                <div class="flex justify-end space-x-4 pt-4"><button type="button" class="cancel-btn px-4 py-2 rounded bg-gray-600">取消</button><button type="submit" class="px-4 py-2 rounded bg-red-600">确认发送</button></div>
            </form>
        `);
        modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('#send-command-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const delay = e.target.delay.value || 0;
            const command = `${action.toUpperCase()} ${delay}`;
            const result = await window.api.sendCommand({ clientId: client.id, command: command });
            if (result.success) { alert('命令已发送成功！'); } else { alert('命令发送失败，客户端可能已离线。'); }
            modal.remove();
        });
    };

    const showClientEditModal = (client) => {
        let groupOptions = `<option value="">未分组</option>` + state.groups.map(g => `<option value="${g.id}" ${client.group_id === g.id ? 'selected' : ''}>${g.name}</option>`).join('');
        const modal = showModal('编辑客户端', `
            <form id="edit-client-form">
                <div class="mb-4"><label class="block mb-2 text-sm font-bold text-gray-400">备注名称</label><input type="text" name="name" value="${client.name || ''}" placeholder="例如：张三的电脑" class="w-full bg-gray-700 p-2 rounded border border-gray-600"></div>
                <div class="mb-4"><label class="block mb-2 text-sm font-bold text-gray-400">所属分组</label><select name="groupId" class="w-full bg-gray-700 p-2 rounded border border-gray-600">${groupOptions}</select></div>
                <div class="flex justify-end space-x-4 mt-6"><button type="button" class="cancel-btn px-4 py-2 rounded bg-gray-600">取消</button><button type="submit" class="px-4 py-2 rounded bg-blue-600">保存</button></div>
            </form>
        `);
        modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('#edit-client-form').addEventListener('submit', async (e) => {
            e.preventDefault(); const formData = new FormData(e.target);
            await window.api.updateClientDetails({ id: client.id, name: formData.get('name'), groupId: formData.get('groupId') ? parseInt(formData.get('groupId')) : null });
            modal.remove(); await refreshData();
        });
    };
    
    document.getElementById('add-group-btn').addEventListener('click', () => {
        const modal = showModal('创建新分组', `
            <form id="add-group-form">
                <input type="text" name="name" placeholder="分组名称 (例如: 财务部)" class="w-full bg-gray-700 p-2 rounded mb-4" required>
                <textarea name="description" placeholder="分组描述 (可选)" class="w-full bg-gray-700 p-2 rounded mb-4"></textarea>
                <div class="flex justify-end space-x-4"><button type="button" class="cancel-btn px-4 py-2 rounded bg-gray-600">取消</button><button type="submit" class="px-4 py-2 rounded bg-blue-600">创建</button></div>
            </form>
        `);
        modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('#add-group-form').addEventListener('submit', async (e) => { e.preventDefault(); await window.api.createGroup(e.target.name.value, e.target.description.value); modal.remove(); await refreshData(); });
    });
    
    document.getElementById('add-task-btn').addEventListener('click', () => {
        if (state.groups.length === 0) { alert('请先创建一个分组，才能为分组创建任务。'); return; }
        const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); const nowString = now.toISOString().slice(0,16);
        let groupOptions = state.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        const modal = showModal('创建新任务', `
            <form id="add-task-form" class="space-y-4">
                <div><label class="block mb-2 text-sm font-bold text-gray-400">任务类型</label><select id="task-type-select" name="taskType" class="w-full bg-gray-700 p-2 rounded"><option value="shutdown">定时关机</option><option value="reboot">定时重启</option><option value="wake">定时唤醒</option></select></div>
                <div id="delay-input-container"><label class="block mb-2 text-sm font-bold text-gray-400">延迟关机/重启时间 (秒)</label><input type="number" name="delaySeconds" value="0" min="0" class="w-full bg-gray-700 p-2 rounded"></div>
                <div><label class="block mb-2 text-sm font-bold text-gray-400">目标分组</label><select name="targetId" class="w-full bg-gray-700 p-2 rounded" required>${groupOptions}</select></div>
                <div><label class="block mb-2 text-sm font-bold text-gray-400">执行时间</label><input type="datetime-local" name="executionTime" value="${nowString}" class="w-full bg-gray-700 p-2 rounded" required></div>
                <div><label class="block mb-2 text-sm font-bold text-gray-400">重复规则</label><select name="recurrence" class="w-full bg-gray-700 p-2 rounded"><option value="once">仅一次</option><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></select></div>
                <div class="flex justify-end space-x-4 pt-4"><button type="button" class="cancel-btn px-4 py-2 rounded bg-gray-600">取消</button><button type="submit" class="px-4 py-2 rounded bg-green-600">创建任务</button></div>
            </form>
        `);
        const taskTypeSelect = modal.querySelector('#task-type-select');
        const delayInputContainer = modal.querySelector('#delay-input-container');
        const toggleDelayInput = () => { delayInputContainer.style.display = ['shutdown', 'reboot'].includes(taskTypeSelect.value) ? 'block' : 'none'; };
        taskTypeSelect.addEventListener('change', toggleDelayInput);
        toggleDelayInput();
        modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('#add-task-form').addEventListener('submit', async (e) => {
            e.preventDefault(); const formData = new FormData(e.target); const executionTime = new Date(formData.get('executionTime')); const recurrence = formData.get('recurrence'); let recurrenceRule = 'once';
            if (recurrence !== 'once') {
                const minutes = executionTime.getMinutes(); const hours = executionTime.getHours(); const dayOfMonth = executionTime.getDate(); const dayOfWeek = executionTime.getDay();
                if (recurrence === 'daily') recurrenceRule = `${minutes} ${hours} * * *`;
                if (recurrence === 'weekly') recurrenceRule = `${minutes} ${hours} * * ${dayOfWeek}`;
                if (recurrence === 'monthly') recurrenceRule = `${minutes} ${hours} ${dayOfMonth} * *`;
            }
            await window.api.createTask({ taskType: formData.get('taskType'), targetType: 'group', targetId: parseInt(formData.get('targetId')), executionTime: executionTime.toISOString(), delaySeconds: parseInt(formData.get('delaySeconds')) || 0, recurrenceRule: recurrenceRule });
            modal.remove(); await refreshData();
        });
    });

    const handleDeleteGroup = async (e) => { const id = parseInt(e.target.dataset.id); if (confirm('确定要删除这个分组吗？分组内的客户端将变为“未分组”。')) { await window.api.deleteGroup(id); await refreshData(); } };
    const handleDeleteTask = async (e) => { const id = parseInt(e.target.dataset.id); if (confirm('确定要取消这个计划任务吗？')) { await window.api.deleteTask(id); await refreshData(); } };
    const handleDeleteClient = async (e) => { e.stopPropagation(); const id = parseInt(e.target.closest('button').dataset.id); if (confirm('确定要永久删除这个离线客户端记录吗？')) { await window.api.deleteClient(id); await refreshData(); } };
    const handleWakeClient = async (e) => { e.stopPropagation(); const mac = e.target.closest('button').dataset.mac; const result = await window.api.wakeClient(mac); if (result.success) { alert(`已向 ${mac} 发送唤醒信号。`); } else { alert(`唤醒失败: ${result.error}`); } };
    
    document.getElementById('clear-offline-btn').addEventListener('click', async () => {
        const offlineClients = Object.values(state.clients).filter(c => c.status !== 'online');
        if (offlineClients.length === 0) { alert('没有可清理的离线客户端。'); return; }
        if (confirm(`确定要永久删除 ${offlineClients.length} 个离线客户端记录吗？`)) { await Promise.all(offlineClients.map(client => window.api.deleteClient(client.id))); await refreshData(); }
    });
    
    document.getElementById('bulk-action-btn').addEventListener('click', () => {
        let targetOptions = `<option value="all">所有设备</option>` + state.groups.map(g => `<option value="${g.id}">分组: ${g.name}</option>`).join('');
        const modal = showModal('一键操作', `
            <form id="bulk-action-form" class="space-y-4">
                <div><label class="block mb-2 text-sm font-bold text-gray-400">选择操作</label><select name="action" class="w-full bg-gray-700 p-2 rounded"><option value="wake">一键唤醒</option><option value="shutdown">一键关机</option><option value="reboot">一键重启</option></select></div>
                <div><label class="block mb-2 text-sm font-bold text-gray-400">选择目标</label><select name="target" class="w-full bg-gray-700 p-2 rounded">${targetOptions}</select></div>
                <div class="flex justify-end space-x-4 pt-4"><button type="button" class="cancel-btn px-4 py-2 rounded bg-gray-600">取消</button><button type="submit" class="px-4 py-2 rounded bg-indigo-600">执行</button></div>
            </form>
        `);
        modal.querySelector('.cancel-btn').addEventListener('click', () => modal.remove());
        modal.querySelector('#bulk-action-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const action = formData.get('action');
            const target = formData.get('target');
            const targetType = target === 'all' ? 'all' : 'group';
            const targetId = target === 'all' ? null : parseInt(target);
            const targetText = target === 'all' ? '所有设备' : `分组 "${state.groups.find(g=>g.id === targetId).name}"`;
            const actionText = { wake: '唤醒', shutdown: '关机', reboot: '重启' }[action];
            if (confirm(`您确定要对 ${targetText} 执行 [${actionText}] 操作吗？\n\n注意：关机/重启操作仅对在线设备有效。`)) {
                const summary = await window.api.executeBulkAction({ action, targetType, targetId });
                let summaryText = `操作 [${actionText}] 已执行。\n总目标数: ${summary.attempted} 个设备。\n`;
                if (action !== 'wake') {
                    summaryText += `在线并发送命令: ${summary.online} 个。\n离线跳过: ${summary.offline} 个。`;
                }
                alert(summaryText);
                modal.remove();
            }
        });
    });

    document.addEventListener('click', (e) => {
        const openMenus = document.querySelectorAll('.action-menu:not(.hidden)');
        openMenus.forEach(menu => { if (!menu.closest('.action-menu-container').contains(e.target)) { menu.classList.add('hidden'); } });
    });
    
    document.getElementById('clients-view').addEventListener('click', async (e) => {
        const target = e.target; const button = target.closest('button');
        if (button?.matches('.toggle-action-menu')) {
            e.stopPropagation();
            const container = button.closest('.action-menu-container');
            const menu = container.querySelector('.action-menu');
            document.querySelectorAll('.action-menu').forEach(m => { if(m !== menu) m.classList.add('hidden'); });
            menu.classList.toggle('hidden');
            return;
        }
        if (target.matches('.send-command-btn')) { e.preventDefault(); e.stopPropagation(); const id = parseInt(target.dataset.id); const action = target.dataset.action; showSendCommandModal(state.clients[id], action); target.closest('.action-menu').classList.add('hidden'); return; }
        if (target.matches('.edit-client-btn')) { e.preventDefault(); e.stopPropagation(); showClientEditModal(state.clients[parseInt(target.dataset.id)]); }
        if (button?.matches('.wake-client-btn')) { await handleWakeClient(e); }
        if (button?.matches('.delete-client-btn')) { await handleDeleteClient(e); }
    });

    // --- 6. 数据刷新和初始化 ---
    const refreshData = async () => {
        const onlineStatuses = {};
        Object.values(state.clients).forEach(c => { if (c.status === 'online') onlineStatuses[c.id] = { ip: c.ip }; });
        const [clientsFromDb, groups, tasks, onlineIds] = await Promise.all([ window.api.getAllClients(), window.api.getAllGroups(), window.api.getPendingTasks(), window.api.getOnlineIds() ]);
        state.clients = {};
        clientsFromDb.forEach(c => {
            state.clients[c.id] = c;
            if (onlineIds.includes(c.id)) {
                state.clients[c.id].status = 'online';
                if (onlineStatuses[c.id]) state.clients[c.id].ip = onlineStatuses[c.id].ip;
            } else {
                state.clients[c.id].status = 'offline';
            }
        });
        state.groups = groups;
        state.tasks = tasks;
        renderAll();
    };

    const initialize = async () => {
        window.api.onClientStatusChange(update => {
            if (state.clients[update.id]) {
                state.clients[update.id].status = update.status;
                if (update.status === 'online') state.clients[update.id].ip = update.ip;
            } else { refreshData(); return; }
            renderClients();
        });
        handleNavigation(window.location.hash);
        window.addEventListener('hashchange', () => handleNavigation(window.location.hash));
        updateClientView();
        await refreshData();
    };
    
    // --- 7. 窗口控制按钮事件绑定 ---
    document.getElementById('minimize-btn').addEventListener('click', () => window.controls.minimize());
    document.getElementById('maximize-btn').addEventListener('click', () => window.controls.maximize());
    document.getElementById('close-btn').addEventListener('click', () => window.controls.close());

    // --- 启动应用 ---
    initialize();
});