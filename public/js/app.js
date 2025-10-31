// API Base URL
const API_URL = '';

// Global state
let currentUser = null;
let token = null;
let allItems = [];
let allUsers = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Check for saved token
    token = localStorage.getItem('token');
    if (token) {
        validateToken();
    }

    // Set up form handlers
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('itemForm').addEventListener('submit', handleItemSubmit);
    document.getElementById('giveItemForm').addEventListener('submit', handleGiveItem);
    document.getElementById('transferForm').addEventListener('submit', handleTransfer);
});

// Auth functions
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.querySelectorAll('.tab-btn')[1].classList.remove('active');
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.querySelectorAll('.tab-btn')[0].classList.remove('active');
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        showMainScreen();
    } catch (error) {
        document.getElementById('loginError').textContent = error.message;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        showMainScreen();
    } catch (error) {
        document.getElementById('registerError').textContent = error.message;
    }
}

async function validateToken() {
    try {
        const response = await fetch(`${API_URL}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Invalid token');
        }

        currentUser = await response.json();
        showMainScreen();
    } catch (error) {
        localStorage.removeItem('token');
        token = null;
        showLoginScreen();
    }
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    showLoginScreen();
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('mainScreen').style.display = 'none';
}

function showMainScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'block';
    
    // Update user info
    document.getElementById('currentUser').textContent = 
        `${currentUser.username} (${currentUser.role === 'admin' ? 'Администратор' : 'Игрок'})`;
    
    // Show/hide admin features
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = currentUser.role === 'admin' ? '' : 'none';
    });

    // Load initial data
    showSection('inventory');
}

// Navigation
function showSection(section) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(s => s.style.display = 'none');

    // Update nav buttons
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));

    // Show selected section
    switch (section) {
        case 'inventory':
            document.getElementById('inventorySection').style.display = 'block';
            navBtns[0].classList.add('active');
            loadInventory();
            break;
        case 'transfers':
            document.getElementById('transfersSection').style.display = 'block';
            navBtns[1].classList.add('active');
            loadTransfers();
            break;
        case 'items':
            document.getElementById('itemsSection').style.display = 'block';
            navBtns[2].classList.add('active');
            loadItems();
            break;
        case 'users':
            document.getElementById('usersSection').style.display = 'block';
            navBtns[3].classList.add('active');
            loadUsers();
            break;
        case 'admin':
            document.getElementById('adminSection').style.display = 'block';
            navBtns[4].classList.add('active');
            loadAdminDashboard();
            break;
    }
}

// Inventory functions
async function loadInventory() {
    try {
        const response = await fetch(`${API_URL}/api/inventory`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const inventory = await response.json();
        displayInventory(inventory);
    } catch (error) {
        console.error('Error loading inventory:', error);
    }
}

function displayInventory(inventory) {
    const container = document.getElementById('inventoryList');
    const emptyState = document.getElementById('inventoryEmpty');

    if (inventory.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    container.style.display = 'grid';
    emptyState.style.display = 'none';
    
    container.innerHTML = inventory.map(item => {
        const stats = item.stats ? JSON.parse(item.stats) : {};
        return `
            <div class="item-card">
                <h3>${item.name}</h3>
                <p>${item.description || 'Нет описания'}</p>
                <div style="margin: 10px 0;">
                    <span class="item-badge badge-${item.item_type}">${getItemTypeName(item.item_type)}</span>
                    <span class="item-badge badge-${item.rarity || 'common'}">${getRarityName(item.rarity || 'common')}</span>
                </div>
                <div class="item-quantity">Количество: ${item.quantity}</div>
                ${Object.keys(stats).length > 0 ? `
                    <div style="font-size: 12px; color: #666;">
                        ${Object.entries(stats).map(([key, value]) => `${key}: ${value}`).join(', ')}
                    </div>
                ` : ''}
                <div class="item-actions">
                    <button onclick="showTransferModal(${item.id}, '${item.name}', ${item.quantity})" class="btn btn-primary">Передать</button>
                </div>
            </div>
        `;
    }).join('');
}

// Transfer functions
async function loadTransfers() {
    try {
        const response = await fetch(`${API_URL}/api/transfers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const transfers = await response.json();
        displayTransfers(transfers);
    } catch (error) {
        console.error('Error loading transfers:', error);
    }
}

function displayTransfers(transfers) {
    const container = document.getElementById('transfersList');
    const emptyState = document.getElementById('transfersEmpty');

    if (transfers.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    container.style.display = 'block';
    emptyState.style.display = 'none';
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>От</th>
                    <th>К</th>
                    <th>Предмет</th>
                    <th>Количество</th>
                    <th>Статус</th>
                </tr>
            </thead>
            <tbody>
                ${transfers.map(t => `
                    <tr>
                        <td>${new Date(t.transfer_date).toLocaleString('ru-RU')}</td>
                        <td>${t.from_username}</td>
                        <td>${t.to_username}</td>
                        <td>${t.item_name}</td>
                        <td>${t.quantity}</td>
                        <td>${t.status === 'completed' ? 'Завершено' : t.status}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function showTransferModal(itemId, itemName, maxQuantity) {
    document.getElementById('transferItemId').value = itemId;
    document.getElementById('transferItemName').value = itemName;
    document.getElementById('transferQuantity').max = maxQuantity;
    document.getElementById('transferModal').style.display = 'block';
}

function closeTransferModal() {
    document.getElementById('transferModal').style.display = 'none';
    document.getElementById('transferForm').reset();
}

async function handleTransfer(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('transferItemId').value;
    const toUsername = document.getElementById('transferToUsername').value;
    const quantity = parseInt(document.getElementById('transferQuantity').value);

    try {
        const response = await fetch(`${API_URL}/api/transfers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ toUsername, itemId, quantity })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Transfer failed');
        }

        alert('Предмет успешно передан!');
        closeTransferModal();
        loadInventory();
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Items management (Admin)
async function loadItems() {
    try {
        const response = await fetch(`${API_URL}/api/items`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        allItems = await response.json();
        displayItems(allItems);
    } catch (error) {
        console.error('Error loading items:', error);
    }
}

function displayItems(items) {
    const container = document.getElementById('itemsList');
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Название</th>
                    <th>Описание</th>
                    <th>Тип</th>
                    <th>Редкость</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr>
                        <td>${item.id}</td>
                        <td>${item.name}</td>
                        <td>${item.description || '-'}</td>
                        <td><span class="item-badge badge-${item.item_type}">${getItemTypeName(item.item_type)}</span></td>
                        <td><span class="item-badge badge-${item.rarity || 'common'}">${getRarityName(item.rarity || 'common')}</span></td>
                        <td>
                            <button onclick="editItem(${item.id})" class="btn btn-secondary" style="width: auto; padding: 8px 16px; font-size: 14px;">Редактировать</button>
                            <button onclick="deleteItem(${item.id})" class="btn btn-danger" style="width: auto; padding: 8px 16px; font-size: 14px;">Удалить</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function showItemModal(itemId = null) {
    if (itemId) {
        const item = allItems.find(i => i.id === itemId);
        if (item) {
            document.getElementById('itemModalTitle').textContent = 'Редактировать предмет';
            document.getElementById('itemId').value = item.id;
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemDescription').value = item.description || '';
            document.getElementById('itemType').value = item.item_type;
            document.getElementById('itemRarity').value = item.rarity || 'common';
            document.getElementById('itemStats').value = item.stats || '';
        }
    } else {
        document.getElementById('itemModalTitle').textContent = 'Создать предмет';
        document.getElementById('itemForm').reset();
        document.getElementById('itemId').value = '';
    }
    document.getElementById('itemModal').style.display = 'block';
}

function closeItemModal() {
    document.getElementById('itemModal').style.display = 'none';
    document.getElementById('itemForm').reset();
}

async function handleItemSubmit(e) {
    e.preventDefault();
    
    const itemId = document.getElementById('itemId').value;
    const name = document.getElementById('itemName').value;
    const description = document.getElementById('itemDescription').value;
    const itemType = document.getElementById('itemType').value;
    const rarity = document.getElementById('itemRarity').value;
    const statsText = document.getElementById('itemStats').value;
    
    let stats = null;
    if (statsText) {
        try {
            stats = JSON.parse(statsText);
        } catch (error) {
            alert('Некорректный формат JSON для характеристик');
            return;
        }
    }

    try {
        const url = itemId ? `${API_URL}/api/items/${itemId}` : `${API_URL}/api/items`;
        const method = itemId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, description, itemType, rarity, stats })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to save item');
        }

        alert(itemId ? 'Предмет обновлен!' : 'Предмет создан!');
        closeItemModal();
        loadItems();
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

function editItem(itemId) {
    showItemModal(itemId);
}

async function deleteItem(itemId) {
    if (!confirm('Вы уверены, что хотите удалить этот предмет?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/items/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to delete item');
        }

        alert('Предмет удален!');
        loadItems();
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Users management (Admin)
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/api/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        allUsers = await response.json();
        displayUsers(allUsers);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsers(users) {
    const container = document.getElementById('usersList');
    
    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Имя пользователя</th>
                    <th>Роль</th>
                    <th>Дата регистрации</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.username}</td>
                        <td>${user.role === 'admin' ? 'Администратор' : 'Игрок'}</td>
                        <td>${new Date(user.created_at).toLocaleString('ru-RU')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Admin dashboard
async function loadAdminDashboard() {
    try {
        // Load statistics
        const statsResponse = await fetch(`${API_URL}/api/statistics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await statsResponse.json();
        displayStatistics(stats);

        // Load data for dropdowns
        await loadUsers();
        await loadItems();
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
    }
}

function displayStatistics(stats) {
    const container = document.getElementById('statsGrid');
    
    container.innerHTML = `
        <div class="stat-card">
            <h3>Всего пользователей</h3>
            <div class="stat-value">${stats.totalUsers}</div>
        </div>
        <div class="stat-card">
            <h3>Всего предметов</h3>
            <div class="stat-value">${stats.totalItems}</div>
        </div>
        <div class="stat-card">
            <h3>Всего переводов</h3>
            <div class="stat-value">${stats.totalTransfers}</div>
        </div>
        <div class="stat-card">
            <h3>Предметов в инвентарях</h3>
            <div class="stat-value">${stats.totalInventoryItems}</div>
        </div>
    `;
}

function showGiveItemModal() {
    // Populate user dropdown
    const userSelect = document.getElementById('giveUserId');
    userSelect.innerHTML = allUsers
        .filter(u => u.role === 'player')
        .map(u => `<option value="${u.id}">${u.username}</option>`)
        .join('');

    // Populate item dropdown
    const itemSelect = document.getElementById('giveItemId');
    itemSelect.innerHTML = allItems
        .map(i => `<option value="${i.id}">${i.name}</option>`)
        .join('');

    document.getElementById('giveItemModal').style.display = 'block';
}

function closeGiveItemModal() {
    document.getElementById('giveItemModal').style.display = 'none';
    document.getElementById('giveItemForm').reset();
}

async function handleGiveItem(e) {
    e.preventDefault();
    
    const userId = document.getElementById('giveUserId').value;
    const itemId = document.getElementById('giveItemId').value;
    const quantity = parseInt(document.getElementById('giveQuantity').value);

    try {
        const response = await fetch(`${API_URL}/api/inventory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, itemId, quantity })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to give item');
        }

        alert('Предмет успешно выдан!');
        closeGiveItemModal();
    } catch (error) {
        alert('Ошибка: ' + error.message);
    }
}

// Helper functions
function getItemTypeName(type) {
    const types = {
        'weapon': 'Оружие',
        'armor': 'Броня',
        'accessory': 'Аксессуар',
        'consumable': 'Расходник',
        'material': 'Материал',
        'other': 'Другое'
    };
    return types[type] || type;
}

function getRarityName(rarity) {
    const rarities = {
        'common': 'Обычный',
        'uncommon': 'Необычный',
        'rare': 'Редкий',
        'epic': 'Эпический',
        'legendary': 'Легендарный'
    };
    return rarities[rarity] || rarity;
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}
