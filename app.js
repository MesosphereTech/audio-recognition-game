// Main application controller
class RetroVoiceGameApp {
    constructor() {
        this.currentScene = 'main-menu';
        this.gameState = {
            currentLevel: null,
            unlockedItems: ['metal', 'paper', 'water'], // Base items
            playerLevel: 1,
            totalScore: 0, // Acts as Inspiration Points / Currency
            completedLevels: [], // Stores IDs of completed levels
            levelScores: {}, // Stores { levelId: bestScore }
            purchasedShopItems: [] // Tracks purchased shop items
        };

        this.init();
    }

    init() {
        // 确保GAME_DATA已经加载
        if (!window.GAME_DATA || !window.GAME_DATA.levels || !Array.isArray(window.GAME_DATA.levels)) {
            console.error('GAME_DATA未正确加载，请刷新页面重试');
            return;
        }

        this.loadGameState(); // Load game state early
        this.initializeComponents();

        // Initialize child modules
        this.menu = new MenuManager(this);
        this.levels = new LevelManager(this);
        this.game = new GameManager(this);
        this.audio = new AudioManager(this); // Pass app instance for notifications

        console.log('🎮 声临奇境：万物皆可配 - 游戏已启动! (v1.0)');
        this.showScene('main-menu');
    }

    loadGameState() {
        const savedState = localStorage.getItem('retro-voice-game-state');
        if (savedState) {
            try {
                const parsedState = JSON.parse(savedState);
                // Merge selectively to avoid overwriting with potentially outdated structure if new fields added
                this.gameState = {
                    ...this.gameState, // Default structure
                    ...parsedState, // Loaded values
                    // Ensure arrays are properly initialized if they are missing from savedState
                    unlockedItems: Array.isArray(parsedState.unlockedItems) ? parsedState.unlockedItems : ['metal', 'paper', 'water'],
                    completedLevels: Array.isArray(parsedState.completedLevels) ? parsedState.completedLevels : [],
                    levelScores: typeof parsedState.levelScores === 'object' && parsedState.levelScores !== null ? parsedState.levelScores : {},
                    purchasedShopItems: Array.isArray(parsedState.purchasedShopItems) ? parsedState.purchasedShopItems : []
                };
                // Ensure base items are always unlocked if somehow removed from save
                const baseItems = ['metal', 'paper', 'water'];
                 baseItems.forEach(item => {
                    if (!this.gameState.unlockedItems.includes(item)) {
                        this.gameState.unlockedItems.push(item);
                    }
                });

                console.log('游戏进度已加载', this.gameState);
            } catch (error) {
                console.warn('无法加载游戏进度，使用默认设置', error);
                // Initialize with defaults if parsing fails or structure is bad
                this.gameState.unlockedItems = ['metal', 'paper', 'water'];
                this.gameState.completedLevels = [];
                this.gameState.levelScores = {};
                this.gameState.purchasedShopItems = [];
            }
        }
    }

    saveGameState() {
        localStorage.setItem('retro-voice-game-state', JSON.stringify(this.gameState));
        console.log('游戏进度已保存', this.gameState);
    }

    initializeComponents() {
        this.addButtonSounds();

        // Ensure base items are present after initial load/parse
        const baseItems = ['metal', 'paper', 'water'];
        baseItems.forEach(item => {
            if (!this.gameState.unlockedItems.includes(item)) {
                this.gameState.unlockedItems.push(item);
            }
        });
        this.saveGameState(); // Save state after ensuring base items
    }

    addButtonSounds() {
        document.body.addEventListener('mouseenter', (event) => {
            const target = event.target.closest('button, .retro-button, .retro-control-button, .retro-record-button, .retro-submit-button, .retro-back-button, .retro-level-card, .retro-item-slot:not(.locked)');
            if (target) {
                this.playUISound('hover');
            }
        }, true);

        document.body.addEventListener('click', (event) => {
            const target = event.target.closest('button:not(:disabled), .retro-button:not(:disabled), .retro-control-button:not(:disabled), .retro-record-button:not(:disabled):not(.recording), .retro-submit-button:not(:disabled), .retro-back-button:not(:disabled), .retro-level-card:not(.locked), .retro-item-slot:not(.locked)');
            if (target) {
                 this.playUISound('click');
            }
             const recordStopTarget = event.target.closest('.retro-record-button.recording:not(:disabled)');
             if (recordStopTarget) {
                 this.playUISound('record_stop');
             }
        }, true);
    }

    showScene(sceneName, options = {}) {
        console.log(`切换场景: ${this.currentScene} -> ${sceneName}`);

        const currentSceneEl = document.getElementById(this.currentScene);
        const nextSceneEl = document.getElementById(sceneName);

        if (!nextSceneEl) {
            console.error(`场景不存在: ${sceneName}`);
            return;
        }

        const transitionDuration = 500; // Should match CSS transition

        if (currentSceneEl) {
            currentSceneEl.classList.remove('active');
        }

        if (options.showLoading) {
            this.showLoadingScreen(options.loadingMessage || '加载中...');
            setTimeout(() => {
                 this.hideLoadingScreen();
                 nextSceneEl.classList.add('active');
                 this.currentScene = sceneName;
                 // Delay onSceneChange to allow CSS transition to visually complete
                 setTimeout(() => this.onSceneChange(sceneName, options), transitionDuration / 2);
            }, options.loadingDuration || 1000);
        } else {
             // Brief delay to allow current scene to start transitioning out
             setTimeout(() => {
                nextSceneEl.classList.add('active');
                this.currentScene = sceneName;
                setTimeout(() => this.onSceneChange(sceneName, options), transitionDuration / 2);
             }, 50); // Small delay for smoother visual transition without loading screen
        }

        if (this.currentScene !== sceneName || options.showLoading) {
             this.playUISound('transition');
        }
    }

    onSceneChange(sceneName, options) {
        console.log(`✅ 场景 ${sceneName} 激活`);
        this.audio.stopBackgroundSound(); // Stop previous BGM
        switch (sceneName) {
            case 'main-menu':
                this.audio.playBackgroundSound('menu');
                break;
            case 'level-select':
                if (this.levels) {
                    this.levels.refresh(); // Refresh level map in case of unlocks
                }
                this.audio.playBackgroundSound('level_select');
                break;
            case 'game-scene':
                if (this.game && options.levelId) {
                    this.game.loadLevel(options.levelId);
                }
                this.audio.playBackgroundSound('game');
                break;
            case 'matching-game-scene':
                if (!this.matchingGame) {
                    this.matchingGame = new AudioMatchingGame(this);
                }
                if (options.levelData) {
                    this.matchingGame.loadLevel(options.levelData);
                }
                this.audio.playBackgroundSound('game');
                break;
            case 'shop': // If shop becomes its own scene, or for shop BGM in modal
                 this.audio.playBackgroundSound('shop');
                 break;
            default:
                // Potentially play a default BGM or nothing
                break;
        }
        this.updateGlobalUI(sceneName); // Update score, room info etc.
    }

    updateGlobalUI(sceneName) {
        const scoreDisplays = document.querySelectorAll('.global-score-display');
        scoreDisplays.forEach(display => {
            display.innerHTML = `灵感: ${this.gameState.totalScore} <span class="retro-coin-icon ml-1"></span>`;
        });

        const gameSceneScoreDisplay = document.getElementById('score-display'); // Specific score display in game scene
        if(gameSceneScoreDisplay) gameSceneScoreDisplay.innerHTML = `总分: ${this.gameState.totalScore} <span class="retro-coin-icon ml-1 text-xs"></span>`;


        const roomInfoPanel = document.getElementById('room-info');
        if (roomInfoPanel) {
             if (sceneName === 'level-select') {
                 roomInfoPanel.classList.remove('hidden');
                 const roomTitle = roomInfoPanel.querySelector('h3');
                 const roomDesc = roomInfoPanel.querySelector('p');

                 const playerLevelsConfig = window.GAME_DATA.config.playerLevels || [];
                 let currentRoom = playerLevelsConfig[0]; // Default to first room

                 // Iterate from highest requirement to lowest to find current room
                 for (let i = playerLevelsConfig.length - 1; i >= 0; i--) {
                    if (this.gameState.playerLevel >= playerLevelsConfig[i].level) {
                        currentRoom = playerLevelsConfig[i];
                        break;
                    }
                 }
                if(roomTitle) roomTitle.textContent = currentRoom.name;
                if(roomDesc) roomDesc.textContent = currentRoom.description;

             } else {
                 roomInfoPanel.classList.add('hidden');
             }
        }
    }

    showLoadingScreen(message = '加载中...') {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
             const messageEl = loadingEl.querySelector('.text-lg');
             if(messageEl) messageEl.textContent = message;
             loadingEl.classList.remove('hidden');
             // Force reflow to ensure transition plays
             void loadingEl.offsetWidth;
             loadingEl.classList.add('opacity-100');
        }
    }

    hideLoadingScreen() {
         const loadingEl = document.getElementById('loading');
         if (loadingEl) {
            loadingEl.classList.remove('opacity-100');
            // Add 'hidden' after transition ends
             setTimeout(() => loadingEl.classList.add('hidden'), 500); // Match transition duration in CSS
         }
    }

    playUISound(type) {
        if (this.audio && this.audio.playSFX) {
             this.audio.playSFX(type);
        } else {
            console.warn('AudioManager or playSFX method not available for UI sounds.');
        }
    }

    updateScore(points) {
        this.gameState.totalScore += points;
        if (this.gameState.totalScore < 0) this.gameState.totalScore = 0; // Prevent negative score
        this.saveGameState();

        console.log(`灵感点数更新: ${points > 0 ? '+' : ''}${points}, 总灵感: ${this.gameState.totalScore}`);
        this.updateGlobalUI(this.currentScene); // This will refresh score displays
        this.checkPlayerLevelUp(this.gameState.totalScore);
    }

    unlockItem(itemId) {
        if (!window.GAME_DATA.items[itemId]) {
            console.warn(`尝试解锁未知物品: ${itemId}`);
            return;
        }
        if (!this.gameState.unlockedItems.includes(itemId)) {
            this.gameState.unlockedItems.push(itemId);
            this.saveGameState();

            const itemName = window.GAME_DATA.items[itemId]?.name || itemId;
            console.log(`解锁新物品: ${itemName}`);
            this.showNotification(`新音色解锁: ${itemName}!`, 'achievement');
            this.playUISound('item_unlock');

            // Refresh UI if relevant views are active
            if (this.currentScene === 'game-scene' && this.game && typeof this.game.refreshItemSlots === 'function') {
                this.game.refreshItemSlots();
            }
            if (this.menu && typeof this.menu.refreshWarehouseUI === 'function') {
                 this.menu.refreshWarehouseUI(); // Refresh warehouse if it's the current modal
            }
        }
    }

    purchaseShopItem(itemId, price) {
        const itemData = window.GAME_DATA.shopItems.find(item => item.id === itemId);
        if (!itemData) {
            this.showNotification("物品不存在！", 'error');
            return false;
        }

        if (this.gameState.purchasedShopItems.includes(itemId)) {
            this.showNotification("你已经拥有这个物品了！", 'error');
            return false;
        }

        if (this.gameState.totalScore >= price) {
            this.updateScore(-price); // Deduct currency using updateScore
            this.gameState.purchasedShopItems.push(itemId);
            this.saveGameState();

            this.showNotification(`购买成功: ${itemData.name}!`, 'achievement');
            this.playUISound('purchase_success');
            this.updateGlobalUI(this.currentScene); // Update score displays globally
            return true;
        } else {
            this.showNotification("灵感点数不足！", 'error');
            this.playUISound('error_negative'); // Use a distinct negative error sound
            return false;
        }
    }


    checkPlayerLevelUp(newTotalScore) {
        let leveledUp = false;
        let message = "";
        const playerLevelsConfig = window.GAME_DATA.config.playerLevels || [];
        let newPlayerLevel = this.gameState.playerLevel;

        // Find the highest level the player qualifies for
        for (let i = 0; i < playerLevelsConfig.length; i++) {
            const levelData = playerLevelsConfig[i];
            if (newTotalScore >= levelData.unlockScore && newPlayerLevel < levelData.level) {
                 newPlayerLevel = levelData.level; // Update to the new highest qualified level
                 message = levelData.unlockMessage || `场景解锁：${levelData.name}!`;
                 leveledUp = true;
                 // Don't break, check all levels in case multiple thresholds are met simultaneously (though unlikely with granular scores)
            }
        }
        
        if(leveledUp && newPlayerLevel > this.gameState.playerLevel) { // Ensure actual level up
            this.gameState.playerLevel = newPlayerLevel;
            this.showNotification(message, 'achievement');
            this.playUISound('level_unlock');
            this.saveGameState();
            this.updateGlobalUI(this.currentScene); // Update room info if visible
        }
    }

    showNotification(message, type = 'achievement') { // 'achievement', 'error', 'info'
        const notificationArea = document.body; // Or a dedicated notification container
        const notification = document.createElement('div');
        
        let baseClass = 'achievement-notification';
        let icon = '🔔'; // Default icon

        switch(type) {
            case 'error':
                baseClass = 'error-notification';
                icon = '⚠️';
                break;
            case 'achievement':
                if (message.toLowerCase().includes('购买成功')) icon = '🛍️';
                else if (message.toLowerCase().includes('广告')) icon = '🌟';
                else if (message.toLowerCase().includes('解锁')) icon = '🎉';
                else icon = '🏆'; // Generic achievement
                break;
            case 'info':
                icon = '💡'; // For informational messages
                baseClass = 'achievement-notification'; // Can reuse style or create new
                break;
        }
        notification.className = baseClass;

        notification.innerHTML = `<span class="mr-2 text-xl">${icon}</span> <span class="flex-1">${message}</span>`;
        notificationArea.appendChild(notification);

        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('active');
        });

        // Auto-remove
        setTimeout(() => {
            notification.classList.remove('active');
            // Remove from DOM after transition
            setTimeout(() => notification.remove(), 600); // Match CSS transition for fade-out
        }, type === 'error' ? 4500 : (type === 'info' ? 3000 : 3800)); // Display duration

        if (type === 'error') {
            this.playUISound('error_negative');
        } else if (type === 'achievement') {
            // Differentiate success sounds based on message content
            if (message.toLowerCase().includes('购买成功') || message.toLowerCase().includes('双倍奖励')) {
                this.playUISound('success_major');
            } else if (message.toLowerCase().includes('解锁')) {
                 this.playUISound('item_unlock'); // Or a generic 'unlock_positive' sound
            } else {
                 this.playUISound('success_minor');
            }
        }
        // No sound for 'info' by default, or could add a neutral 'info_ping'
    }

    // Alias for showScene - used by matching game
    switchToScene(sceneName, options = {}) {
        this.showScene(sceneName, options);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 确保GAME_DATA已经加载
    if (!window.GAME_DATA || !window.GAME_DATA.levels || !Array.isArray(window.GAME_DATA.levels)) {
        console.error('GAME_DATA未正确加载，请刷新页面重试');
        return;
    }

    // 确保所有必要的对象都存在
    if (!window.GAME_DATA.items || !window.GAME_DATA.config || !window.GAME_DATA.scoring) {
        console.error('GAME_DATA缺少必要的配置对象');
        return;
    }

    // 初始化游戏
    window.retroVoiceGame = new RetroVoiceGameApp();
    console.log('游戏数据加载成功:', window.GAME_DATA.levels.length, '个关卡可用');
});
