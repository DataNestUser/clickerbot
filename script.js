// Конфигурация
const ADMINS = [8480811736]; // Замените на ваш Telegram ID
const OFFLINE_EARNING_RATE = 0.01; // Монет в секунду
const API_URL = 'http://localhost:5000/api'; // URL вашего Python-сервера
const MAX_WARNINGS = 2; // Максимальное количество предупреждений перед блокировкой

// Игровое состояние
let gameState = {
    coins: 0,
    clickPower: 1,
    autoClickers: 0,
    clickMultiplier: 1,
    totalClicks: 0,
    level: 1,
    xp: 0,
    xpNeeded: 100,
    achievements: {},
    boosters: {},
    dailyRewards: {
        lastClaim: null,
        streak: 0
    },
    minigames: {},
    upgrades: {},
    lastPlayed: Date.now(),
    userId: null,
    username: 'Игрок',
    // Новые поля для системы блокировок
    accountStatus: {
        isBanned: false,
        isFrozen: false,
        banReason: '',
        banExpires: null,
        freezeReason: '',
        freezeExpires: null,
        warnings: 0,
        warningHistory: [],
        lastWarning: null
    },
    // Статистика для обнаружения читерства
    stats: {
        clicksPerSecond: 0,
        lastClickTime: null,
        suspiciousActivity: 0
    }
};

// Инициализация Telegram Web App
Telegram.WebApp.ready();
Telegram.WebApp.expand();
Telegram.WebApp.setHeaderColor('#3390ec');
Telegram.WebApp.setBackgroundColor('#667eea');

// Получение данных пользователя Telegram
function initUserData() {
    const user = Telegram.WebApp.initDataUnsafe.user;
    if (user) {
        gameState.userId = user.id;
        gameState.username = user.first_name || user.username || 'Игрок';
    }
}

// Загрузка состояния
async function loadGame() {
    initUserData();
    
    // Пытаемся загрузить с сервера
    if (gameState.userId) {
        try {
            const response = await fetch(`${API_URL}/user/${gameState.userId}`);
            if (response.ok) {
                const serverState = await response.json();
                Object.assign(gameState, serverState);
                
                // Проверяем оффлайн заработок
                checkOfflineEarnings();
                showNotification('Прогресс загружен с сервера!');
            }
        } catch (error) {
            console.log('Сервер недоступен, загружаем из localStorage');
            loadFromLocalStorage();
        }
    } else {
        loadFromLocalStorage();
    }
    
    initGameData();
    updateUI();
    checkAccountStatus();
    initializeAchievements();
    updateDailyRewardsUI();
    loadShopItems();
    loadBoosters();
    loadMinigames();
}

// Загрузка из localStorage
function loadFromLocalStorage() {
    const saved = localStorage.getItem('clickerGame');
    if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(gameState, parsed);
        checkOfflineEarnings();
    }
}

// Проверка оффлайн заработка
function checkOfflineEarnings() {
    if (gameState.accountStatus.isBanned || gameState.accountStatus.isFrozen) {
        return; // Не начисляем оффлайн заработок заблокированным/замороженным аккаунтам
    }
    
    if (gameState.lastPlayed && gameState.upgrades.offlineEarnings && gameState.upgrades.offlineEarnings.level > 0) {
        const timeDiff = Date.now() - gameState.lastPlayed;
        const offlineSeconds = Math.min(timeDiff / 1000, 24 * 60 * 60); // Максимум 24 часа
        const offlineEarnings = Math.floor(offlineSeconds * OFFLINE_EARNING_RATE * gameState.upgrades.offlineEarnings.level);
        
        if (offlineEarnings > 0) {
            gameState.coins += offlineEarnings;
            showNotification(`Оффлайн заработок: +${offlineEarnings} 🪙`);
        }
    }
}

// Инициализация игровых данных
function initGameData() {
    // Инициализация достижений
    if (!gameState.achievements.firstClick) {
        gameState.achievements = {
            firstClick: { unlocked: false, progress: 0, target: 1, reward: 50 },
            hundredClicks: { unlocked: false, progress: 0, target: 100, reward: 100 },
            thousandCoins: { unlocked: false, progress: 0, target: 1000, reward: 500 },
            level5: { unlocked: false, progress: 0, target: 5, reward: 200 },
            level10: { unlocked: false, progress: 0, target: 10, reward: 500 },
            autoClicker: { unlocked: false, progress: 0, target: 1, reward: 150 },
            boosterUser: { unlocked: false, progress: 0, target: 1, reward: 200 },
            dailyPlayer: { unlocked: false, progress: 0, target: 3, reward: 300 },
            millionaire: { unlocked: false, progress: 0, target: 1000000, reward: 10000 }
        };
    }

    // Инициализация бустеров
    if (!gameState.boosters.doubleCoins) {
        gameState.boosters = {
            doubleCoins: { active: false, timeLeft: 0, multiplier: 2 },
            turboClick: { active: false, timeLeft: 0, multiplier: 5 },
            autoBoost: { active: false, timeLeft: 0, multiplier: 3 },
            megaBoost: { active: false, timeLeft: 0, multiplier: 10 }
        };
    }

    // Инициализация улучшений
    if (!gameState.upgrades.clickPower) {
        gameState.upgrades = {
            clickPower: { level: 1, cost: 50 },
            autoClicker: { level: 0, cost: 100 },
            clickMultiplier: { level: 0, cost: 500 },
            offlineEarnings: { level: 0, cost: 1000 }
        };
    }

    // Инициализация мини-игр
    if (!gameState.minigames.clickChallenge) {
        gameState.minigames = {
            clickChallenge: { bestScore: 0, played: 0 },
            timingGame: { bestScore: 0, played: 0 },
            memoryGame: { bestScore: 0, played: 0 }
        };
    }
    
    // Инициализация статуса аккаунта
    if (!gameState.accountStatus) {
        gameState.accountStatus = {
            isBanned: false,
            isFrozen: false,
            banReason: '',
            banExpires: null,
            freezeReason: '',
            freezeExpires: null,
            warnings: 0,
            warningHistory: [],
            lastWarning: null
        };
    }
    
    // Инициализация статистики
    if (!gameState.stats) {
        gameState.stats = {
            clicksPerSecond: 0,
            lastClickTime: null,
            suspiciousActivity: 0
        };
    }
}

// Проверка статуса аккаунта
function checkAccountStatus() {
    const now = Date.now();
    
    // Проверяем истечение срока блокировки
    if (gameState.accountStatus.isBanned && gameState.accountStatus.banExpires) {
        if (now > gameState.accountStatus.banExpires) {
            gameState.accountStatus.isBanned = false;
            gameState.accountStatus.banReason = '';
            gameState.accountStatus.banExpires = null;
            showNotification('Срок блокировки истек! Аккаунт разблокирован.');
        }
    }
    
    // Проверяем истечение срока заморозки
    if (gameState.accountStatus.isFrozen && gameState.accountStatus.freezeExpires) {
        if (now > gameState.accountStatus.freezeExpires) {
            gameState.accountStatus.isFrozen = false;
            gameState.accountStatus.freezeReason = '';
            gameState.accountStatus.freezeExpires = null;
            showNotification('Срок заморозки истек! Аккаунт разморожен.');
        }
    }
    
    // Обновляем интерфейс в зависимости от статуса
    updateAccountStatusUI();
    
    // Сохраняем изменения
    saveGame();
}

// Обновление UI статуса аккаунта
function updateAccountStatusUI() {
    const accountStatusElement = document.getElementById('accountStatus');
    const clickBtn = document.getElementById('clickBtn');
    
    if (gameState.accountStatus.isBanned) {
        document.body.classList.add('banned');
        document.getElementById('accountBanned').classList.remove('hidden');
        
        // Обновляем информацию о блокировке
        document.getElementById('banReason').textContent = gameState.accountStatus.banReason || 'Нарушение правил использования';
        if (gameState.accountStatus.banExpires) {
            const expireDate = new Date(gameState.accountStatus.banExpires).toLocaleDateString();
            document.getElementById('banExpires').textContent = `Блокировка действует до: ${expireDate}`;
        } else {
            document.getElementById('banExpires').textContent = 'Блокировка постоянная';
        }
        
        // Показываем статус в основном интерфейсе
        accountStatusElement.innerHTML = `
            <div class="account-status banned">
                🚫 Аккаунт заблокирован: ${gameState.accountStatus.banReason}
            </div>
        `;
        
        // Отключаем кнопку клика
        if (clickBtn) {
            clickBtn.disabled = true;
            clickBtn.style.opacity = '0.5';
            clickBtn.style.cursor = 'not-allowed';
        }
        
    } else if (gameState.accountStatus.isFrozen) {
        document.body.classList.add('frozen');
        document.getElementById('accountFrozen').classList.remove('hidden');
        
        // Обновляем информацию о заморозке
        document.getElementById('freezeReason').textContent = gameState.accountStatus.freezeReason || 'Подозрительная активность';
        if (gameState.accountStatus.freezeExpires) {
            const expireDate = new Date(gameState.accountStatus.freezeExpires).toLocaleDateString();
            document.getElementById('freezeExpires').textContent = `Заморозка действует до: ${expireDate}`;
        } else {
            document.getElementById('freezeExpires').textContent = 'Заморозка постоянная';
        }
        
        // Показываем статус в основном интерфейсе
        accountStatusElement.innerHTML = `
            <div class="account-status frozen">
                ❄️ Аккаунт заморожен: ${gameState.accountStatus.freezeReason}
            </div>
        `;
        
        // Отключаем кнопку клика
        if (clickBtn) {
            clickBtn.disabled = true;
            clickBtn.style.opacity = '0.5';
            clickBtn.style.cursor = 'not-allowed';
        }
        
    } else {
        document.body.classList.remove('banned', 'frozen');
        document.getElementById('accountBanned').classList.add('hidden');
        document.getElementById('accountFrozen').classList.add('hidden');
        
        // Включаем кнопку клика
        if (clickBtn) {
            clickBtn.disabled = false;
            clickBtn.style.opacity = '1';
            clickBtn.style.cursor = 'pointer';
        }
        
        // Показываем предупреждения, если есть
        if (gameState.accountStatus.warnings > 0) {
            accountStatusElement.innerHTML = `
                <div class="account-status warning">
                    ⚠️ У вас ${gameState.accountStatus.warnings} предупреждений. Будьте осторожны!
                </div>
            `;
        } else {
            accountStatusElement.innerHTML = '';
        }
    }
}

// Система обнаружения читерства
function detectCheating() {
    const now = Date.now();
    
    // Проверяем скорость кликов
    if (gameState.stats.lastClickTime) {
        const timeDiff = now - gameState.stats.lastClickTime;
        if (timeDiff < 50) { // Меньше 50ms между кликами - подозрительно
            gameState.stats.suspiciousActivity++;
            
            if (gameState.stats.suspiciousActivity > 10) {
                // Автоматическая блокировка за читерство
                autoBanUser('Автоматическое обнаружение читерства (автокликер)');
                return;
            }
        } else if (timeDiff > 1000) {
            // Сбрасываем счетчик, если клики нормальные
            gameState.stats.suspiousActivity = Math.max(0, gameState.stats.suspiciousActivity - 1);
        }
    }
    
    gameState.stats.lastClickTime = now;
    
    // Проверяем нереалистичные значения
    if (gameState.coins > 1000000 && gameState.level < 10) {
        // Слишком много монет для низкого уровня
        autoBanUser('Подозрительно высокое количество монет');
    }
    
    if (gameState.clickPower > 1000) {
        // Нереалистичная сила клика
        autoBanUser('Нереалистичные показатели силы клика');
    }
}

// Автоматическая блокировка
function autoBanUser(reason) {
    gameState.accountStatus.isBanned = true;
    gameState.accountStatus.banReason = reason;
    gameState.accountStatus.banExpires = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 дней
    
    showNotification(`Аккаунт заблокирован: ${reason}`);
    updateAccountStatusUI();
    saveGame();
}

// Основной клик с проверкой статуса
function clickHandler(e) {
    // Проверяем статус аккаунта
    if (gameState.accountStatus.isBanned) {
        showNotification("Ваш аккаунт заблокирован!");
        return;
    }
    
    if (gameState.accountStatus.isFrozen) {
        showNotification("Ваш аккаунт заморожен! Действия временно недоступны.");
        return;
    }
    
    // Проверяем на читерство
    detectCheating();
    
    createCoinAnimation(e);
    
    let clickStrength = gameState.clickPower * gameState.clickMultiplier;
    
    // Применяем активные бустеры
    if (gameState.boosters.doubleCoins.active) {
        clickStrength *= gameState.boosters.doubleCoins.multiplier;
    }
    if (gameState.boosters.turboClick.active) {
        clickStrength *= gameState.boosters.turboClick.multiplier;
    }
    if (gameState.boosters.megaBoost.active) {
        clickStrength *= gameState.boosters.megaBoost.multiplier;
    }
    
    gameState.coins += Math.floor(clickStrength);
    gameState.totalClicks++;
    
    addXP(1);
    checkAchievements();
    
    updateUI();
    saveGame();
}

// Привязываем обработчик клика
document.getElementById('clickBtn').addEventListener('click', clickHandler);

// Система предупреждений
function addWarning(reason, issuedBy = 'system') {
    const warning = {
        reason: reason,
        issuedBy: issuedBy,
        timestamp: Date.now(),
        id: Math.random().toString(36).substr(2, 9)
    };
    
    gameState.accountStatus.warnings++;
    gameState.accountStatus.warningHistory.push(warning);
    gameState.accountStatus.lastWarning = Date.now();
    
    // Показываем уведомление о предупреждении
    showWarningNotification(reason, gameState.accountStatus.warnings);
    
    // Автоматическая блокировка при достижении максимума предупреждений
    if (gameState.accountStatus.warnings >= MAX_WARNINGS) {
        autoBanUser(`Достигнут лимит предупреждений (${MAX_WARNINGS})`);
    }
    
    saveGame();
}

// Показ уведомления о предупреждении
function showWarningNotification(reason, warningCount) {
    const notification = document.createElement('div');
    notification.className = 'warning-notification';
    notification.innerHTML = `
        <h3>⚠️ ВЫДАНО ПРЕДУПРЕЖДЕНИЕ</h3>
        <p>Причина: ${reason}</p>
        <div class="warning-count">Количество предупреждений: ${warningCount}/${MAX_WARNINGS}</div>
        <p>При достижении ${MAX_WARNINGS} предупреждений аккаунт будет заблокирован</p>
        <button onclick="this.parentElement.remove()">Понятно</button>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 10 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

// Контакт с поддержкой
function contactSupport() {
    const message = `Поддержка Super Clicker\nID пользователя: ${gameState.userId}\nПроблема: ${gameState.accountStatus.isBanned ? 'Блокировка аккаунта' : 'Заморозка аккаунта'}`;
    alert(message);
    // В реальном приложении здесь можно открыть чат с поддержкой
}

// АДМИН-ФУНКЦИИ

// Поиск пользователя
let currentSearchedUser = null;

async function searchUser() {
    const userId = document.getElementById('searchUserId').value;
    if (!userId) {
        showNotification('Введите ID пользователя');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/user/${userId}`);
        if (response.ok) {
            currentSearchedUser = await response.json();
            displayUserInfo(currentSearchedUser);
        } else {
            showNotification('Пользователь не найден');
        }
    } catch (error) {
        showNotification('Ошибка при поиске пользователя');
    }
}

// Отображение информации о пользователе
function displayUserInfo(user) {
    const userInfo = document.getElementById('userInfo');
    
    let statusClass = 'normal';
    let statusText = 'Нормальный';
    
    if (user.accountStatus.isBanned) {
        statusClass = 'banned';
        statusText = 'Заблокирован';
    } else if (user.accountStatus.isFrozen) {
        statusClass = 'frozen';
        statusText = 'Заморожен';
    } else if (user.accountStatus.warnings > 0) {
        statusClass = 'warning';
        statusText = `Предупреждения: ${user.accountStatus.warnings}`;
    }
    
    userInfo.innerHTML = `
        <h4>Информация о пользователе</h4>
        <div class="user-stats">
            <div>ID: ${user.userId}</div>
            <div>Имя: ${user.username}</div>
            <div>Уровень: ${user.level}</div>
            <div>Монеты: ${user.coins}</div>
            <div>Кликов: ${user.totalClicks}</div>
            <div>Автокликеров: ${user.autoClickers}</div>
        </div>
        <div class="user-status ${statusClass}">
            Статус: ${statusText}
        </div>
        ${user.accountStatus.warningHistory.length > 0 ? `
            <div class="warning-history">
                <h5>История предупреждений:</h5>
                ${user.accountStatus.warningHistory.map(warning => `
                    <div>${new Date(warning.timestamp).toLocaleDateString()}: ${warning.reason} (${warning.issuedBy})</div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    userInfo.classList.remove('hidden');
}

// Блокировка пользователя
function adminBanUser() {
    if (!currentSearchedUser) {
        showNotification('Сначала найдите пользователя');
        return;
    }
    
    showBanModal();
}

// Модальное окно для блокировки
function showBanModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Блокировка пользователя</h3>
            <select id="banReasonSelect">
                <option value="Читерство">Читерство</option>
                <option value="Оскорбления">Оскорбления</option>
                <option value="Мошенничество">Мошенничество</option>
                <option value="Спам">Спам</option>
                <option value="Другое">Другое</option>
            </select>
            <textarea id="banCustomReason" placeholder="Дополнительная информация (необязательно)"></textarea>
            <select id="banDuration">
                <option value="3600000">1 час</option>
                <option value="86400000">1 день</option>
                <option value="604800000">1 неделя</option>
                <option value="2592000000">1 месяц</option>
                <option value="0">Навсегда</option>
            </select>
            <div class="modal-actions">
                <button onclick="closeModal()">Отмена</button>
                <button onclick="confirmBan()">Заблокировать</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Подтверждение блокировки
async function confirmBan() {
    const reasonSelect = document.getElementById('banReasonSelect');
    const customReason = document.getElementById('banCustomReason').value;
    const duration = document.getElementById('banDuration').value;
    
    const reason = customReason ? `${reasonSelect.value}: ${customReason}` : reasonSelect.value;
    const expires = duration === '0' ? null : Date.now() + parseInt(duration);
    
    // Обновляем данные пользователя
    currentSearchedUser.accountStatus.isBanned = true;
    currentSearchedUser.accountStatus.banReason = reason;
    currentSearchedUser.accountStatus.banExpires = expires;
    
    // Сохраняем на сервере
    try {
        await fetch(`${API_URL}/user/${currentSearchedUser.userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentSearchedUser)
        });
        
        showNotification('Пользователь заблокирован');
        closeModal();
        displayUserInfo(currentSearchedUser);
    } catch (error) {
        showNotification('Ошибка при блокировке пользователя');
    }
}

// Разблокировка пользователя
async function adminUnbanUser() {
    if (!currentSearchedUser) {
        showNotification('Сначала найдите пользователя');
        return;
    }
    
    currentSearchedUser.accountStatus.isBanned = false;
    currentSearchedUser.accountStatus.banReason = '';
    currentSearchedUser.accountStatus.banExpires = null;
    
    try {
        await fetch(`${API_URL}/user/${currentSearchedUser.userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentSearchedUser)
        });
        
        showNotification('Пользователь разблокирован');
        displayUserInfo(currentSearchedUser);
    } catch (error) {
        showNotification('Ошибка при разблокировке пользователя');
    }
}

// Заморозка пользователя
function adminFreezeUser() {
    if (!currentSearchedUser) {
        showNotification('Сначала найдите пользователя');
        return;
    }
    
    showFreezeModal();
}

// Модальное окно для заморозки
function showFreezeModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Заморозка аккаунта</h3>
            <select id="freezeReasonSelect">
                <option value="Подозрительная активность">Подозрительная активность</option>
                <option value="Проверка на читерство">Проверка на читерство</option>
                <option value="Технические работы">Технические работы</option>
                <option value="Другое">Другое</option>
            </select>
            <textarea id="freezeCustomReason" placeholder="Дополнительная информация (необязательно)"></textarea>
            <select id="freezeDuration">
                <option value="3600000">1 час</option>
                <option value="86400000">1 день</option>
                <option value="604800000">1 неделя</option>
                <option value="2592000000">1 месяц</option>
                <option value="0">Навсегда</option>
            </select>
            <div class="modal-actions">
                <button onclick="closeModal()">Отмена</button>
                <button onclick="confirmFreeze()">Заморозить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Подтверждение заморозки
async function confirmFreeze() {
    const reasonSelect = document.getElementById('freezeReasonSelect');
    const customReason = document.getElementById('freezeCustomReason').value;
    const duration = document.getElementById('freezeDuration').value;
    
    const reason = customReason ? `${reasonSelect.value}: ${customReason}` : reasonSelect.value;
    const expires = duration === '0' ? null : Date.now() + parseInt(duration);
    
    currentSearchedUser.accountStatus.isFrozen = true;
    currentSearchedUser.accountStatus.freezeReason = reason;
    currentSearchedUser.accountStatus.freezeExpires = expires;
    
    try {
        await fetch(`${API_URL}/user/${currentSearchedUser.userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentSearchedUser)
        });
        
        showNotification('Аккаунт заморожен');
        closeModal();
        displayUserInfo(currentSearchedUser);
    } catch (error) {
        showNotification('Ошибка при заморозке аккаунта');
    }
}

// Разморозка пользователя
async function adminUnfreezeUser() {
    if (!currentSearchedUser) {
        showNotification('Сначала найдите пользователя');
        return;
    }
    
    currentSearchedUser.accountStatus.isFrozen = false;
    currentSearchedUser.accountStatus.freezeReason = '';
    currentSearchedUser.accountStatus.freezeExpires = null;
    
    try {
        await fetch(`${API_URL}/user/${currentSearchedUser.userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentSearchedUser)
        });
        
        showNotification('Аккаунт разморожен');
        displayUserInfo(currentSearchedUser);
    } catch (error) {
        showNotification('Ошибка при разморозке аккаунта');
    }
}

// Выдача предупреждения
function adminWarnUser() {
    if (!currentSearchedUser) {
        showNotification('Сначала найдите пользователя');
        return;
    }
    
    showWarnModal();
}

// Модальное окно для предупреждения
function showWarnModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Выдача предупреждения</h3>
            <select id="warnReasonSelect">
                <option value="Нарушение правил чата">Нарушение правил чата</option>
                <option value="Неуважительное поведение">Неуважительное поведение</option>
                <option value="Подозрение в читерстве">Подозрение в читерстве</option>
                <option value="Спам">Спам</option>
                <option value="Другое">Другое</option>
            </select>
            <textarea id="warnCustomReason" placeholder="Дополнительная информация (необязательно)"></textarea>
            <div class="modal-actions">
                <button onclick="closeModal()">Отмена</button>
                <button onclick="confirmWarn()">Выдать предупреждение</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Подтверждение предупреждения
async function confirmWarn() {
    const reasonSelect = document.getElementById('warnReasonSelect');
    const customReason = document.getElementById('warnCustomReason').value;
    
    const reason = customReason ? `${reasonSelect.value}: ${customReason}` : reasonSelect.value;
    
    // Добавляем предупреждение
    const warning = {
        reason: reason,
        issuedBy: `admin_${gameState.userId}`,
        timestamp: Date.now(),
        id: Math.random().toString(36).substr(2, 9)
    };
    
    currentSearchedUser.accountStatus.warnings++;
    currentSearchedUser.accountStatus.warningHistory.push(warning);
    currentSearchedUser.accountStatus.lastWarning = Date.now();
    
    try {
        await fetch(`${API_URL}/user/${currentSearchedUser.userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentSearchedUser)
        });
        
        showNotification('Предупреждение выдано');
        closeModal();
        displayUserInfo(currentSearchedUser);
        
        // Автоматическая блокировка при достижении максимума
        if (currentSearchedUser.accountStatus.warnings >= MAX_WARNINGS) {
            currentSearchedUser.accountStatus.isBanned = true;
            currentSearchedUser.accountStatus.banReason = `Достигнут лимит предупреждений (${MAX_WARNINGS})`;
            currentSearchedUser.accountStatus.banExpires = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 дней
            
            await fetch(`${API_URL}/user/${currentSearchedUser.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(currentSearchedUser)
            });
            
            showNotification('Пользователь автоматически заблокирован за превышение лимита предупреждений');
            displayUserInfo(currentSearchedUser);
        }
    } catch (error) {
        showNotification('Ошибка при выдаче предупреждения');
    }
}

// Закрытие модального окна
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Остальные функции (updateUI, saveGame, и т.д.) остаются без изменений
// Но добавляем проверки статуса аккаунта в ключевые функции:

// В функции buyUpgrade добавляем проверку:
function buyUpgrade(type) {
    if (gameState.accountStatus.isBanned) {
        showNotification("Ваш аккаунт заблокирован!");
        return;
    }
    
    if (gameState.accountStatus.isFrozen) {
        showNotification("Ваш аккаунт заморожен! Покупки недоступны.");
        return;
    }
    
    // ... остальной код покупки
}

// В функции activateBooster добавляем проверку:
function activateBooster(type, cost, duration) {
    if (gameState.accountStatus.isBanned) {
        showNotification("Ваш аккаунт заблокирован!");
        return;
    }
    
    if (gameState.accountStatus.isFrozen) {
        showNotification("Ваш аккаунт заморожен! Бустеры недоступны.");
        return;
    }
    
    // ... остальной код активации бустера
}

// Инициализация при загрузке
window.onload = function() {
    loadGame();
};

// Автоматическая проверка статуса каждую минуту
setInterval(() => {
    checkAccountStatus();
}, 60000);