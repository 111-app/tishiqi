// ========================
// 提示气 - 提醒小助手
// ========================

(function () {
    'use strict';

    // ---- 常量 ----
    const STORAGE_KEY = 'tiShiQi_reminders';
    const FIRED_KEY = 'tiShiQi_fired';
    const CHECK_INTERVAL = 30 * 1000; // 30秒检查一次
    const TYPE_MAP = {
        workday: { label: '工作日', icon: '📅' },
        daily:   { label: '每天',   icon: '🔄' },
        monthly: { label: '月末',   icon: '📆' },
    };

    // ---- 工具函数 ----
    function genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function todayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }

    function nowHHMM() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function isWorkday(d) {
        const day = d.getDay();
        return day >= 1 && day <= 5; // 周一~周五
    }

    function getMonthDay() {
        return new Date().getDate();
    }

    function getLastDayOfMonth() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }

    // ---- 数据存取 ----
    function loadReminders() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveReminders(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function loadFired() {
        try {
            const data = JSON.parse(localStorage.getItem(FIRED_KEY)) || {};
            // 清理非今天的记录
            const today = todayStr();
            Object.keys(data).forEach(k => {
                if (!data[k] || data[k].date !== today) delete data[k];
            });
            return data;
        } catch {
            return {};
        }
    }

    function getFiredCount(id) {
        const fired = loadFired();
        return (fired[id] && fired[id].count) || 0;
    }

    function markFired(id) {
        const fired = loadFired();
        const today = todayStr();
        if (!fired[id] || fired[id].date !== today) {
            fired[id] = { date: today, count: 1, lastFire: Date.now() };
        } else {
            fired[id].count += 1;
            fired[id].lastFire = Date.now();
        }
        localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
    }

    function getLastFireTime(id) {
        const fired = loadFired();
        return (fired[id] && fired[id].lastFire) || 0;
    }

    // ---- 通知权限 ----
    function isSecureContext() {
        return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
    }

    function checkNotificationPermission() {
        if (!isSecureContext()) return false;
        if (!('Notification' in window)) return false;
        return Notification.permission === 'granted';
    }

    function requestNotificationPermission() {
        if (!isSecureContext()) {
            // HTTP 环境，显示部署引导
            document.getElementById('notif-guide').classList.remove('hidden');
            document.getElementById('perm-banner').classList.add('hidden');
            return;
        }
        if (!('Notification' in window)) {
            document.getElementById('notif-guide').classList.remove('hidden');
            return;
        }
        Notification.requestPermission().then(perm => {
            updatePermBanner();
            if (perm === 'granted') {
                showToast('🎉 通知权限已开启');
            } else if (perm === 'denied') {
                // 用户拒绝了，显示手动引导
                document.getElementById('notif-guide').classList.remove('hidden');
                document.getElementById('perm-banner').classList.add('hidden');
            }
        });
    }

    function updatePermBanner() {
        const banner = document.getElementById('perm-banner');
        const guide = document.getElementById('notif-guide');
        if (checkNotificationPermission()) {
            banner.classList.add('hidden');
            guide.classList.add('hidden');
        } else if (!isSecureContext()) {
            // HTTP 环境，直接显示引导
            banner.classList.add('hidden');
            guide.classList.remove('hidden');
        } else {
            banner.classList.remove('hidden');
        }
    }

    // ---- PWA 安装提示 ----
    let deferredPrompt = null;
    function initInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            // 显示安装提示
            showInstallBanner();
        });
    }

    function showInstallBanner() {
        let banner = document.getElementById('install-banner');
        if (banner) return;

        banner = document.createElement('div');
        banner.id = 'install-banner';
        banner.className = 'perm-banner';
        banner.style.background = '#ECFDF5';
        banner.style.color = '#065F46';
        banner.style.borderBottom = '1px solid #A7F3D0';
        banner.innerHTML = `
            <div style="flex:1;">
                <span>📲 添加到手机桌面，随时收到提醒</span>
                <div id="install-manual" class="hidden" style="font-size:0.8rem;margin-top:4px;color:#047857;">
                    请点浏览器菜单 ⋮ →「添加到主屏幕」
                </div>
            </div>
            <button class="btn-small" style="background:#10B981" id="btn-install">安装</button>
        `;
        const header = document.querySelector('.header');
        header.parentNode.insertBefore(banner, header.nextSibling);

        const btnInstall = document.getElementById('btn-install');
        const manualText = document.getElementById('install-manual');

        btnInstall.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') showToast('✅ 已添加到桌面');
                deferredPrompt = null;
                banner.remove();
            } else {
                // 浏览器没给安装弹窗，显示手动指引
                manualText.classList.remove('hidden');
                showToast('请用浏览器菜单「添加到主屏幕」');
            }
        });

        // 3秒后如果没触发自动安装提示，显示手动指引
        setTimeout(() => {
            if (!deferredPrompt && document.getElementById('install-banner')) {
                manualText.classList.remove('hidden');
            }
        }, 3000);
    }

    function sendNotification(title, body) {
        if (!checkNotificationPermission()) return;
        try {
            const notif = new Notification(title, {
                body: body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>',
                badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>',
                tag: 'tishiqi-' + title + '-' + Date.now(),
                requireInteraction: false,
            });
            // 8秒后自动关闭
            setTimeout(() => notif.close(), 8000);
        } catch (e) {
            console.warn('通知发送失败:', e);
        }
    }

    // ---- Toast 提示 ----
    function showToast(msg) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.cssText = `
                position:fixed;top:20%;left:50%;transform:translateX(-50%);
                background:rgba(0,0,0,0.75);color:#fff;padding:10px 20px;
                border-radius:8px;font-size:0.9rem;z-index:999;
                transition:opacity 0.3s;pointer-events:none;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    }

    // ---- 判断是否应该触发 ----
    function shouldFire(reminder) {
        if (!reminder.enabled) return false;

        const maxCount = reminder.count || 1;
        const firedCount = getFiredCount(reminder.id);

        // 已达到最大次数
        if (firedCount >= maxCount) return false;

        const now = new Date();
        const [th, tm] = reminder.time.split(':').map(Number);
        const targetMinutes = th * 60 + tm;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        if (firedCount === 0) {
            // 第一次触发：在目标时间后的窗口内
            const diff = nowMinutes - targetMinutes;
            if (diff < 0 || diff > 60) return false;
        } else {
            // 后续触发：距上次触发至少1分钟
            const elapsed = Date.now() - getLastFireTime(reminder.id);
            if (elapsed < 60 * 1000) return false;
            // 总时间窗口不超过 60 分钟
            const totalDiff = nowMinutes - targetMinutes;
            if (totalDiff > 60) return false;
        }

        const type = reminder.type || 'workday';

        if (type === 'workday') {
            return isWorkday(now);
        } else if (type === 'daily') {
            return true;
        } else if (type === 'monthly') {
            const targetDay = reminder.day || 30;
            const lastDay = getLastDayOfMonth();
            const actualDay = Math.min(targetDay, lastDay);
            return getMonthDay() === actualDay;
        }
        return false;
    }

    // ---- 主检查循环 ----
    function checkReminders() {
        const list = loadReminders();
        const now = new Date();
        const timeStr = nowHHMM();

        let firedCount = 0;
        list.forEach(r => {
            if (shouldFire(r)) {
                const maxCount = r.count || 1;
                const currentNum = getFiredCount(r.id) + 1;
                const msg = r.message || r.name;
                const title = maxCount > 1
                    ? `⏰ ${r.name}（第${currentNum}/${maxCount}次）`
                    : `⏰ ${r.name}`;
                sendNotification(title, msg);
                markFired(r.id);
                firedCount++;
            }
        });

        // 更新状态栏
        const statusEl = document.getElementById('status-text');
        const activeCount = list.filter(r => r.enabled).length;
        statusEl.textContent = `🟢 运行中 · ${timeStr} · ${activeCount}个提醒已启用`;
    }

    // ---- 渲染列表 ----
    function renderList() {
        const list = loadReminders();
        const container = document.getElementById('reminder-list');
        const countBadge = document.getElementById('reminder-count');

        countBadge.textContent = list.length;

        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>📋 还没有提醒</p>
                    <p class="empty-hint">点击下方按钮添加你的第一个提醒</p>
                </div>`;
            return;
        }

        container.innerHTML = list.map(r => {
            const t = TYPE_MAP[r.type] || TYPE_MAP.workday;
            return `
                <div class="reminder-card ${r.enabled ? '' : 'disabled'}" data-id="${r.id}">
                    <div class="card-icon ${r.type || 'workday'}">${t.icon}</div>
                    <div class="card-info" data-action="edit" data-id="${r.id}">
                        <div class="card-name">${escHtml(r.name)}</div>
                        <div class="card-meta">
                            <span class="card-time">${r.time}</span>
                            <span class="card-type-tag">${t.label}${r.type === 'monthly' ? r.day + '号' : ''}</span>
                            <span class="card-type-tag">${r.count > 1 ? r.count + '次' : ''}</span>
                        </div>
                    </div>
                    <div class="toggle-wrap">
                        <input type="checkbox" class="toggle" data-action="toggle" data-id="${r.id}" ${r.enabled ? 'checked' : ''}>
                    </div>
                </div>`;
        }).join('');
    }

    function escHtml(s) {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    // ---- 弹窗控制 ----
    function openModal(editData) {
        const overlay = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const form = document.getElementById('reminder-form');
        const btnDel = document.getElementById('btn-delete');

        form.reset();
        document.getElementById('edit-id').value = '';
        document.getElementById('monthly-day-group').style.display = 'none';

        if (editData) {
            // 编辑模式
            title.textContent = '编辑提醒';
            document.getElementById('edit-id').value = editData.id;
            document.getElementById('input-name').value = editData.name;
            document.getElementById('input-time').value = editData.time;
            document.getElementById('input-type').value = editData.type || 'workday';
            document.getElementById('input-day').value = editData.day || 30;
            document.getElementById('input-message').value = editData.message || '';
            document.getElementById('input-count').value = editData.count || 1;
            btnDel.classList.remove('hidden');
            // 显示月末日期输入
            if (editData.type === 'monthly') {
                document.getElementById('monthly-day-group').style.display = '';
            }
        } else {
            title.textContent = '添加提醒';
            btnDel.classList.add('hidden');
        }

        overlay.classList.remove('hidden');
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }

    function getEditData() {
        const id = document.getElementById('edit-id').value;
        if (!id) return null;
        const list = loadReminders();
        return list.find(r => r.id === id) || null;
    }

    // ---- 事件绑定 ----
    function initEvents() {
        // 添加按钮
        document.getElementById('btn-add').addEventListener('click', () => openModal(null));

        // 关闭弹窗
        document.getElementById('modal-close').addEventListener('click', closeModal);
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });

        // 通知权限按钮
        document.getElementById('btn-enable-notif').addEventListener('click', requestNotificationPermission);

        // 类型切换 → 显示/隐藏月末日期
        document.getElementById('input-type').addEventListener('change', (e) => {
            const group = document.getElementById('monthly-day-group');
            group.style.display = e.target.value === 'monthly' ? '' : 'none';
        });

        // 表单提交
        document.getElementById('reminder-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const list = loadReminders();
            const editId = document.getElementById('edit-id').value;
            const data = {
                id: editId || genId(),
                name: document.getElementById('input-name').value.trim(),
                time: document.getElementById('input-time').value,
                type: document.getElementById('input-type').value,
                day: parseInt(document.getElementById('input-day').value) || 30,
                message: document.getElementById('input-message').value.trim(),
                count: parseInt(document.getElementById('input-count').value) || 1,
                enabled: true,
            };

            if (editId) {
                // 更新
                const idx = list.findIndex(r => r.id === editId);
                if (idx >= 0) {
                    data.enabled = list[idx].enabled; // 保留开关状态
                    list[idx] = data;
                }
                showToast('✅ 已更新');
            } else {
                list.push(data);
                showToast('✅ 已添加');
            }

            saveReminders(list);
            renderList();
            closeModal();
        });

        // 删除按钮
        document.getElementById('btn-delete').addEventListener('click', () => {
            const editId = document.getElementById('edit-id').value;
            if (!editId) return;
            if (!confirm('确定要删除这个提醒吗？')) return;
            const list = loadReminders().filter(r => r.id !== editId);
            saveReminders(list);
            renderList();
            closeModal();
            showToast('🗑️ 已删除');
        });

        // 列表点击事件（委托）
        document.getElementById('reminder-list').addEventListener('click', (e) => {
            const target = e.target;

            // 开关切换
            if (target.dataset.action === 'toggle') {
                const id = target.dataset.id;
                const list = loadReminders();
                const item = list.find(r => r.id === id);
                if (item) {
                    item.enabled = target.checked;
                    saveReminders(list);
                    renderList();
                    showToast(item.enabled ? '✅ 已启用' : '⏸️ 已暂停');
                }
                return;
            }

            // 编辑
            const editTarget = target.closest('[data-action="edit"]');
            if (editTarget) {
                const id = editTarget.dataset.id;
                const list = loadReminders();
                const item = list.find(r => r.id === id);
                if (item) openModal(item);
            }
        });
    }

    // ---- 页面可见性变化时重新检查 ----
    function initVisibilityCheck() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                renderList();
                updatePermBanner();
                checkReminders();
            }
        });
    }

    // ---- Service Worker 注册 ----
    function registerSW() {
        if ('serviceWorker' in navigator) {
            const scope = location.pathname.replace(/[^/]*$/, ''); // 当前目录作为 scope
            navigator.serviceWorker.register('sw.js', { scope: scope }).catch((err) => {
                console.log('SW 注册失败：', err);
            });
        }
    }

    // ---- 初始化 ----
    function init() {
        renderList();
        updatePermBanner();
        initEvents();
        initVisibilityCheck();
        initInstallPrompt();
        registerSW();

        // 首次检查
        checkReminders();

        // 定时检查
        setInterval(checkReminders, CHECK_INTERVAL);

        // 请求通知权限提示
        if (isSecureContext() && 'Notification' in window && Notification.permission === 'default') {
            setTimeout(() => {
                requestNotificationPermission();
            }, 2000);
        }
    }

    // DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
