// Menu management system
class MenuManager {
    constructor(app) {
        this.app = app;
        this.currentModal = null;
        this._currentModalEscapeHandler = null; // Store escape handler for removal
        this.init();
    }

    init() {
        // 确保GAME_DATA已经加载
        if (!window.GAME_DATA) {
            console.error('GAME_DATA未加载，菜单系统初始化失败');
            return;
        }
        
        this.setupMenuButtons();
        this.setupNavigationButtons();
        this.setupModalCloseButtons(); // Centralized modal close logic
        console.log(`📋 主菜单系统已初始化 (v${window.GAME_DATA.config?.version || '1.0'})`);
    }

    setupMenuButtons() {
        const startGameBtn = document.getElementById('start-game-btn');
        const warehouseBtn = document.getElementById('warehouse-btn');
        const shopBtn = document.getElementById('shop-btn');
        const settingsBtn = document.getElementById('settings-btn');
        const watchAdMainMenuBtn = document.getElementById('watch-ad-main-menu-btn');

        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => {
                this.app.showScene('level-select', { showLoading: true, loadingDuration: 800 });
            });
        }
        if (warehouseBtn) warehouseBtn.addEventListener('click', () => this.showWarehouse());
        if (shopBtn) shopBtn.addEventListener('click', () => this.showShop());
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.showSettings());
        if (watchAdMainMenuBtn) watchAdMainMenuBtn.addEventListener('click', () => this.showAdForReward('main_menu_insp_boost'));
    }

    setupNavigationButtons() {
        const backToMenuBtn = document.getElementById('back-to-menu');
        const backToLevelsBtn = document.getElementById('back-to-levels');

        if (backToMenuBtn) {
            backToMenuBtn.addEventListener('click', () => {
                this.app.showScene('main-menu', { showLoading: false });
            });
        }
        if (backToLevelsBtn) {
            backToLevelsBtn.addEventListener('click', () => {
                 if (this.app.game && typeof this.app.game.leaveLevelCleanup === 'function') {
                     this.app.game.leaveLevelCleanup();
                 }
                this.app.showScene('level-select', { showLoading: true, loadingDuration: 800 });
            });
        }
    }
    
    setupModalCloseButtons() {
        const genericModalOverlay = document.getElementById('generic-modal-overlay');
        const scoreModalOverlay = document.getElementById('score-modal');
        const objectiveModalOverlay = document.getElementById('objective-modal');


        const setupCloseLogic = (modalOverlay, isObjectiveModal = false) => {
            if (!modalOverlay) return;
            // Objective modal doesn't have a generic close button, only a start button
            if (!isObjectiveModal) {
                const closeButton = modalOverlay.querySelector('.generic-modal-close-btn, .score-modal-close-btn');
                const actionCloseButton = modalOverlay.querySelector('.generic-modal-action-close-btn');
                const handler = () => this.hideModal(modalOverlay);
                if (closeButton) closeButton.addEventListener('click', handler);
                if (actionCloseButton) actionCloseButton.addEventListener('click', handler);
            }
        };

        setupCloseLogic(genericModalOverlay);
        setupCloseLogic(scoreModalOverlay);
        setupCloseLogic(objectiveModalOverlay, true); // Special handling for objective modal if needed
    }


    showWarehouse() {
        console.log('📋 打开物品仓库');
        const warehouseContent = this.generateWarehouseContent();
        this.showModal(window.GAME_DATA.texts.buttons.warehouse || "怪奇仓库", warehouseContent, (modalElement) => {
             modalElement.querySelectorAll('.warehouse-content .retro-item-slot[data-unlocked="true"]').forEach(slot => {
                 slot.addEventListener('click', () => {
                     const itemId = slot.dataset.itemId;
                     const sample = this.app.audio.getSoundLibrarySample(itemId);
                     if(sample && sample.url) {
                         this.app.audio.playSFX(sample.url); // Play actual sample URL
                         this.app.showNotification(`播放音效: ${window.GAME_DATA.items[itemId]?.name || itemId}`, 'info');
                     } else {
                        this.app.playUISound('error_negative'); // Fallback sound if sample missing
                        this.app.showNotification(`物品 ${itemId} 暂无试听音效。`, 'error');
                     }
                 });
             });
        });
    }
    
    refreshWarehouseUI() {
        if (this.currentModal && this.currentModal.id === 'generic-modal-overlay' && this.currentModal.querySelector('#generic-modal-title').textContent === (window.GAME_DATA.texts.buttons.warehouse || "怪奇仓库")) {
            const newWarehouseContent = this.generateWarehouseContent();
            this.currentModal.querySelector('#generic-modal-body').innerHTML = newWarehouseContent;
            // Re-attach event listeners for the new items
             this.currentModal.querySelectorAll('.warehouse-content .retro-item-slot[data-unlocked="true"]').forEach(slot => {
                 slot.addEventListener('click', () => {
                     const itemId = slot.dataset.itemId;
                     const sample = this.app.audio.getSoundLibrarySample(itemId);
                     if(sample && sample.url) {
                         this.app.audio.playSFX(sample.url);
                         this.app.showNotification(`播放音效: ${window.GAME_DATA.items[itemId]?.name || itemId}`, 'info');
                     } else {
                        this.app.playUISound('error_negative');
                        this.app.showNotification(`物品 ${itemId} 暂无试听音效。`, 'error');
                     }
                 });
             });
        }
    }

    generateWarehouseContent() {
        const unlockedItems = this.app.gameState.unlockedItems || [];
        const allItems = window.GAME_DATA.items;
        let content = '<div class="warehouse-content text-gray-200">';
        content += '<p class="text-sm text-gray-400 text-center mb-3">点击已解锁物品可以试听其代表音效。</p>';
        content += '<div class="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">';

        Object.entries(allItems).forEach(([itemId, item]) => {
            const isUnlocked = unlockedItems.includes(itemId);
            const itemClass = isUnlocked ? '' : 'locked opacity-60 filter grayscale';
            const titleText = isUnlocked ? `${item.name}: ${item.description || '点击试听'}` : `未解锁 - ${item.unlockRequirements || '通过游戏关卡解锁'}`;
            content += `
                <div class="retro-item-slot p-2 flex flex-col items-center justify-center ${itemClass} group"
                     data-item-id="${itemId}" ${isUnlocked ? 'data-unlocked="true"' : ''}
                     title="${titleText}">
                    <img src="${item.icon}" alt="${item.name}" class="retro-item-icon !w-10 !h-10 sm:!w-12 sm:!h-12 object-contain mb-1">
                    <div class="text-xs sm:text-sm text-center truncate w-full retro-text-shadow-light">${item.name}</div>
                    ${!isUnlocked ? `<div class="text-xxs text-red-400 mt-0.5">${item.unlockRequirements || '需解锁'}</div>` : ''}
                </div>
            `;
        });
        content += '</div>';
        content += `<p class="text-sm text-gray-400 text-center">已解锁音色库: ${unlockedItems.length} / ${Object.keys(allItems).length}</p>`;
        content += '</div>';
        return content;
    }

    showShop() {
        console.log('🛒 打开声纳超市');
        this.app.onSceneChange('shop', {}); // Trigger BGM change if shop has one
        this.refreshShopUI(true);
    }

    refreshShopUI(isInitialShow = false) {
        const shopTitle = window.GAME_DATA.texts.buttons.shop || "声纳超市";
        const shopContent = this.generateShopContent();

        const setupShopListeners = (modalElem) => {
            modalElem.querySelectorAll('.shop-item-purchase-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const itemId = event.currentTarget.dataset.itemId;
                    const itemPrice = parseInt(event.currentTarget.dataset.itemPrice);
                    if (this.app.purchaseShopItem(itemId, itemPrice)) {
                        this.refreshShopUI(); 
                    }
                });
            });
            const buyCurrencyBtn = modalElem.querySelector('#buy-currency-modal-btn');
            if (buyCurrencyBtn) {
                buyCurrencyBtn.addEventListener('click', () => this.showBuyCurrencyOptions());
            }
        };
        
        if (isInitialShow || (this.currentModal && this.currentModal.id === 'generic-modal-overlay' && this.currentModal.querySelector('#generic-modal-title').textContent === shopTitle)) {
            if(isInitialShow) {
                this.showModal(shopTitle, shopContent, setupShopListeners);
            } else {
                this.currentModal.querySelector('#generic-modal-body').innerHTML = shopContent;
                setupShopListeners(this.currentModal);
                this.app.updateGlobalUI(this.app.currentScene);
            }
        }
    }

    generateShopContent() {
        const shopItems = window.GAME_DATA.shopItems;
        const playerCurrency = this.app.gameState.totalScore;
        const purchasedShopItems = this.app.gameState.purchasedShopItems || [];

        let content = '<div class="shop-content text-gray-200">';
        content += `<div class="text-center mb-4"><p class="text-lg text-yellow-400">当前灵感: <span class="font-bold">${playerCurrency}</span> <span class="retro-coin-icon ml-1"></span></p></div>`;
        content += `<div class="text-center mb-6"><button id="buy-currency-modal-btn" class="retro-button secondary small"><span class="retro-button-text">获取更多灵感!</span></button></div>`;
        content += '<hr class="border-gray-700 my-4">';
        content += '<h4 class="text-md font-bold text-center text-cyan-300 mb-3">特殊配音商品</h4>';
        content += '<div class="space-y-3 sm:space-y-4 mb-4">';

        if (shopItems.length === 0) {
            content += '<p class="text-center text-gray-500">商店今天没啥好东西，下次再来看看吧！</p>';
        }

        shopItems.forEach(item => {
             const canAfford = playerCurrency >= item.price;
             const isPurchased = purchasedShopItems.includes(item.id);
             let buttonText = `<span class="retro-coin-icon mr-1"></span> ${item.price}`;
             let buttonClasses = "retro-button primary small shop-item-purchase-btn";
             let buttonDisabled = false;

             if (isPurchased) {
                buttonText = "已拥有";
                buttonClasses = "retro-button disabled small";
                buttonDisabled = true;
             } else if (!canAfford) {
                buttonClasses = "retro-button primary small shop-item-purchase-btn opacity-50 cursor-not-allowed";
                buttonDisabled = true;
             }

            content += `
                <div class="retro-panel p-3 flex items-center justify-between gap-2 ${isPurchased ? 'opacity-70 filter grayscale-[0.5]' : ''}">
                    <img src="${item.icon}" alt="${item.name}" class="w-10 h-10 sm:w-12 sm:h-12 object-contain flex-shrink-0 mr-2">
                    <div class="flex-1">
                        <div class="font-bold text-cyan-300">${item.name}</div>
                        <div class="text-xs text-gray-400">${item.description}</div>
                        ${item.effectDescription ? `<div class="text-xs text-purple-300 mt-1">效果: ${item.effectDescription}</div>` : ''}
                    </div>
                    <button class="${buttonClasses}" data-item-id="${item.id}" data-item-price="${item.price}" ${buttonDisabled ? 'disabled' : ''}>
                        <span class="retro-button-text">${buttonText}</span>
                    </button>
                </div>
            `;
        });
        content += '</div>';
        content += '</div>';
        return content;
    }

    showBuyCurrencyOptions() {
         console.log('💵 打开购买灵感界面 (模拟)');
         const buyCurrencyContent = this.generateBuyCurrencyContent();
         this.showModal('购买灵感 <span class="retro-coin-icon ml-1"></span>', buyCurrencyContent, (modalElem) => {
             modalElem.querySelectorAll('.buy-currency-btn').forEach(button => {
                 button.addEventListener('click', (event) => {
                     const packageId = event.currentTarget.dataset.packageId;
                     const amount = parseInt(event.currentTarget.dataset.amount);
                     const priceText = event.currentTarget.dataset.priceText;
                     this.simulateCurrencyPurchase(packageId, amount, priceText);
                 });
             });
         });
    }

    generateBuyCurrencyContent() {
        const currencyPackages = [
            { id: 'insp_small', name: '灵感小包', amount: 100, priceDisplay: '¥ 6', icon: 'assets/ui/icons/currency_pack_small.png' },
            { id: 'insp_medium', name: '灵感中包', amount: 550, priceDisplay: '¥ 30', icon: 'assets/ui/icons/currency_pack_medium.png' },
            { id: 'insp_large', name: '灵感大包', amount: 1200, priceDisplay: '¥ 60', icon: 'assets/ui/icons/currency_pack_large.png' },
            { id: 'insp_epic', name: '灵感巨富包', amount: 3000, priceDisplay: '¥ 128', icon: 'assets/ui/icons/currency_pack_epic.png' }
        ];

        let content = '<div class="buy-currency-content text-gray-200">';
        content += `<p class="text-center mb-1 text-lg text-yellow-400">当前灵感: <span class="font-bold">${this.app.gameState.totalScore}</span> <span class="retro-coin-icon ml-1"></span></p>`;
        content += '<p class="text-sm text-gray-400 text-center mb-4">选择你想要购买的灵感包 (模拟支付流程):</p>';
        content += '<div class="space-y-3">';

        currencyPackages.forEach(pkg => {
            content += `
                <div class="retro-panel p-3 flex items-center justify-between gap-3">
                    <img src="${pkg.icon}" alt="${pkg.name}" class="w-12 h-12 sm:w-16 sm:h-16 object-contain flex-shrink-0 mr-2">
                    <div class="flex-1">
                        <div class="font-bold text-yellow-300">${pkg.name}</div>
                        <div class="text-sm text-green-400">+ ${pkg.amount} <span class="retro-coin-icon text-xs"></span></div>
                    </div>
                    <button class="retro-button primary small buy-currency-btn" data-package-id="${pkg.id}" data-amount="${pkg.amount}" data-price-text="${pkg.priceDisplay}">
                       <span class="retro-button-text">${pkg.priceDisplay}</span>
                    </button>
                </div>
            `;
        });

        content += '</div>';
        content += '</div>';
        return content;
    }

    simulateCurrencyPurchase(packageId, amount, priceText) {
        console.log(`💳 模拟购买灵感包: ${packageId} (${priceText}) for ${amount} Inspiration`);
        this.app.playUISound('click'); 

        this.app.showLoadingScreen(); 
        setTimeout(() => {
            this.app.hideLoadingScreen();
            
            this.app.updateScore(amount); 

            this.app.showNotification(`成功购买 ${priceText} 灵感包，获得 ${amount} 灵感！`, 'achievement');
            // this.app.playUISound('purchase_success'); // Already handled by showNotification

            console.log(`购买成功！获得 ${amount} 灵感。`);
            
            this.hideModal(); 
            this.refreshShopUI(); 
            
        }, 1500); 
    }

    showAdForReward(placementContext, rewardMultiplier = 1, baseReward = 50) {
        const contextMessages = {
            'main_menu_insp_boost': {
                loading: '正在准备灵感加油站广告...',
                playing: '观看广告中，稍后领取灵感！',
                rewardAmount: baseReward, 
                successMessage: (amount) => `广告观看完毕！获得 ${amount} 灵感奖励！`
            },
            'score_double_reward': {
                loading: '正在准备双倍奖励广告...',
                playing: '观看广告中，双倍灵感即将来袭！',
                rewardAmount: baseReward * rewardMultiplier, 
                successMessage: (amount) => `双倍奖励已到账！额外获得 ${amount} 灵感！`
            }
        };
        const currentContext = contextMessages[placementContext] || contextMessages['main_menu_insp_boost'];
        const rewardAmount = currentContext.rewardAmount;

        console.log(`📺 准备播放激励视频广告 (${placementContext})`);
        this.app.playUISound('click');

        this.app.showLoadingScreen();
        this.app.showNotification(currentContext.loading, 'info');

        setTimeout(() => {
            this.app.hideLoadingScreen();
            console.log(`▶️ 模拟播放激励视频广告... (${placementContext})`);
            this.app.showNotification(currentContext.playing, 'info');

            setTimeout(() => {
                console.log(`✅ 激励视频广告播放完成 (${placementContext})`);
                this.app.updateScore(rewardAmount);

                this.app.showNotification(currentContext.successMessage(rewardAmount), 'achievement');
                // this.app.playUISound('success_major'); // Already handled by showNotification
                
                if (placementContext === 'score_double_reward') {
                    const scoreModal = document.getElementById('score-modal');
                    if (scoreModal && scoreModal.classList.contains('active')) {
                        const earnedPointsEl = scoreModal.querySelector('#earned-points');
                        if (earnedPointsEl) {
                             const basePointsText = earnedPointsEl.dataset.basePoints || '0';
                             const totalPoints = parseInt(basePointsText) + rewardAmount; // total should be base + what this ad gives
                             earnedPointsEl.innerHTML = `+${totalPoints} <span class="retro-coin-icon ml-1"></span> <span class="text-sm">灵感</span> <span class="text-green-400 text-xs">(含双倍!)</span>`;
                        }
                        const watchAdBtn = scoreModal.querySelector('#watch-ad-double-reward');
                        if(watchAdBtn) watchAdBtn.classList.add('hidden');
                    }
                }
                 this.refreshShopUI();
            }, 3000); 
        }, 1000); 
    }

    showDoubleRewardAdOption(initialEarnedPoints) {
        const scoreModal = document.getElementById('score-modal');
        if (!scoreModal) return;

        const watchAdBtn = scoreModal.querySelector('#watch-ad-double-reward');
        const earnedPointsEl = scoreModal.querySelector('#earned-points');

        if (watchAdBtn && earnedPointsEl) {
             earnedPointsEl.dataset.basePoints = initialEarnedPoints;

             watchAdBtn.classList.remove('hidden');
             watchAdBtn.innerHTML = `<span class="retro-button-text">观看广告获取双倍灵感 (再得 ${initialEarnedPoints})!</span>`; // Clarify it's additional
             
             const newBtn = watchAdBtn.cloneNode(true);
             watchAdBtn.parentNode.replaceChild(newBtn, watchAdBtn);

             newBtn.addEventListener('click', () => {
                 this.showAdForReward('score_double_reward', 1, initialEarnedPoints); 
             });
        }
    }


    showSettings() {
        console.log('📋 打开游戏设置');
        const settingsContent = this.generateSettingsContent();
        this.showModal(window.GAME_DATA.texts.buttons.settings || "调校参数", settingsContent, (modalElem) => {
            const masterVolumeSlider = modalElem.querySelector('#master-volume-slider');
            const sfxVolumeSlider = modalElem.querySelector('#sfx-volume-slider');
            const bgmVolumeSlider = modalElem.querySelector('#bgm-volume-slider');
            const resetDataBtn = modalElem.querySelector('#reset-game-data-btn');

            const updateVolumeValue = (slider, appAudioMethod) => {
                const valueSpan = slider.nextElementSibling;
                valueSpan.textContent = `${slider.value}%`;
                appAudioMethod.call(this.app.audio, parseInt(slider.value));
            };
            
            if (masterVolumeSlider) masterVolumeSlider.addEventListener('input', (e) => updateVolumeValue(e.target, this.app.audio.setMasterVolume));
            if (sfxVolumeSlider) sfxVolumeSlider.addEventListener('input', (e) => updateVolumeValue(e.target, this.app.audio.setSFXVolume));
            if (bgmVolumeSlider) bgmVolumeSlider.addEventListener('input', (e) => updateVolumeValue(e.target, this.app.audio.setBGMVolume));
            
            if (resetDataBtn) {
                resetDataBtn.addEventListener('click', () => {
                    if (confirm('警告！这将清除所有游戏进度和购买记录，确定要重置吗？此操作无法撤销！')) {
                        localStorage.removeItem('retro-voice-game-state');
                        this.app.showNotification('游戏数据已重置。请刷新页面应用更改。', 'achievement');
                        this.hideModal();
                        setTimeout(() => window.location.reload(), 2000);
                    }
                });
            }
        });
    }

    generateSettingsContent() {
        const audioMgr = this.app.audio;
        const currentMasterVol = audioMgr ? Math.round(audioMgr.masterVolume * 100) : 80;
        const currentSfxVol = audioMgr ? Math.round(audioMgr.sfxVolume * 100) : 70;
        const currentBgmVol = audioMgr ? Math.round(audioMgr.bgmVolume * 100) : 60;

        return `
            <div class="settings-content space-y-6 text-gray-200">
                <div class="retro-section p-3">
                    <h3 class="retro-section-title mb-3">音频设置</h3>
                    <div class="space-y-3 text-sm">
                        ${this.generateSliderHtml('主音量', 'master-volume-slider', currentMasterVol)}
                        ${this.generateSliderHtml('音效音量', 'sfx-volume-slider', currentSfxVol)}
                        ${this.generateSliderHtml('背景音乐', 'bgm-volume-slider', currentBgmVol)}
                    </div>
                </div>
                <div class="retro-section p-3">
                    <h3 class="retro-section-title mb-3">数据管理</h3>
                     <button id="reset-game-data-btn" class="retro-button danger small w-full"><span class="retro-button-text">重置游戏数据 (警告!)</span></button>
                </div>
                 <div class="text-center text-xs text-gray-600 mt-4 p-2">
                    <p>游戏版本: ${window.GAME_DATA.config.version || "1.0.0-dev"}</p>
                    <p class="mt-1">模拟广告位 (仅占位)</p>
                    <div class="h-8 bg-gray-700/50 border border-dashed border-gray-500 flex items-center justify-center text-gray-500 mt-1">
                        小型横幅广告
                    </div>
                </div>
            </div>
        `;
    }
    
    generateSliderHtml(labelText, sliderId, currentValue) {
        return `
            <div class="flex items-center justify-between">
                <label for="${sliderId}" class="flex-1">${labelText}</label>
                <input type="range" class="retro-slider w-1/2" min="0" max="100" value="${currentValue}" id="${sliderId}">
                <span class="w-10 text-right text-xs text-gray-400">${currentValue}%</span>
            </div>
        `;
    }


    showModal(title, content, onOpenCallback = null) {
        const overlay = document.getElementById('generic-modal-overlay');
        const modalTitleEl = document.getElementById('generic-modal-title');
        const modalBodyEl = document.getElementById('generic-modal-body');

        if (!overlay || !modalTitleEl || !modalBodyEl ) {
            console.error("Generic modal elements not found in DOM!");
            return;
        }

        if (this.currentModal && this.currentModal !== overlay && this.currentModal.classList.contains('active')) {
             this.hideModal(this.currentModal); 
        }

        modalTitleEl.innerHTML = title;
        modalBodyEl.innerHTML = content;
        
        if (this._currentModalEscapeHandler) {
            document.removeEventListener('keydown', this._currentModalEscapeHandler);
        }
        this._currentModalEscapeHandler = (e) => {
            if (e.key === 'Escape') this.hideModal(overlay);
        };
        document.addEventListener('keydown', this._currentModalEscapeHandler);

        overlay.classList.remove('hidden');
        void overlay.offsetWidth; 
        overlay.classList.add('active');
        this.currentModal = overlay; 

        if (onOpenCallback && typeof onOpenCallback === 'function') {
            setTimeout(() => onOpenCallback(overlay), 50); // Pass modal element to callback
        }
        this.app.playUISound('modal_open');
    }

    hideModal(modalElement = this.currentModal, callback = null) {
        if (modalElement && modalElement.classList.contains('active')) {
            modalElement.classList.remove('active');
            setTimeout(() => {
                 modalElement.classList.add('hidden');
                 if (modalElement === this.currentModal) { 
                      if (this._currentModalEscapeHandler) {
                          document.removeEventListener('keydown', this._currentModalEscapeHandler);
                          this._currentModalEscapeHandler = null;
                      }
                      this.currentModal = null;
                 }
                 if (callback && typeof callback === 'function') {
                     callback();
                 }
            }, 300);
            this.app.playUISound('modal_close');
        } else if (callback && typeof callback === 'function') {
             callback();
        }
    }
    
    showModalDirectly(modalElement, onOpenCallback = null) {
         if (!modalElement) {
             console.error("Cannot show modal directly, element is null.");
             return;
         }
        if (this.currentModal && this.currentModal !== modalElement && this.currentModal.classList.contains('active')) {
             this.hideModal(this.currentModal);
        }
        
        if (this._currentModalEscapeHandler) {
            document.removeEventListener('keydown', this._currentModalEscapeHandler);
        }
        // For modals shown directly (like score, objective), escape might not be desired or handled differently
        // Add specific escape handler if needed for this modal type.
        if (modalElement.id !== 'objective-modal') { // Objective modal is special
            this._currentModalEscapeHandler = (e) => {
                if (e.key === 'Escape') this.hideModal(modalElement);
            };
            document.addEventListener('keydown', this._currentModalEscapeHandler);
        }


         modalElement.classList.remove('hidden');
         void modalElement.offsetWidth;
         modalElement.classList.add('active');
         this.currentModal = modalElement;

         if (onOpenCallback && typeof onOpenCallback === 'function') {
            setTimeout(() => onOpenCallback(modalElement), 50); // Pass modal element
        }
         // Sound is usually played by caller if it's a specific modal
    }
}
