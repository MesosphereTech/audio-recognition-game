// Level selection and management
class LevelManager {
    constructor(app) {
        this.app = app;
        this.levelsData = window.GAME_DATA.levels; // All available level definitions
        this.init();
    }

    init() {
        this.renderLevelMap(); // Initial render
        console.log('🎯 关卡系统已初始化');
    }

    renderLevelMap() {
        const levelMapContainer = document.getElementById('level-map');
        if (!levelMapContainer) {
            console.error("Level map container not found!");
            return;
        }
        levelMapContainer.innerHTML = ''; // Clear previous cards

        this.levelsData.forEach((level, index) => {
            const levelCard = this.createLevelCard(level, index);
            levelMapContainer.appendChild(levelCard);
        });
    }

    createLevelCard(levelData, index) {
        const card = document.createElement('div');
        const isUnlocked = this.isLevelUnlocked(levelData, index);
        const completionData = this.getLevelCompletionData(levelData.id);
        const stars = completionData.stars;
        const highScore = completionData.score;

        card.className = `retro-level-card ${stars > 0 ? 'completed' : ''} ${!isUnlocked ? 'locked' : ''}`;
        card.dataset.levelId = levelData.id;

        let unlockReqText = "";
        if (!isUnlocked) {
            if (index > 0) {
                 const prevLevel = this.levelsData[index - 1];
                 unlockReqText = `需先完成关卡 "${prevLevel.title}"`;
            } else { // Should not happen for first level if logic is correct
                 unlockReqText = "未知解锁条件";
            }
        }

        card.innerHTML = `
            <div class="retro-level-number">${index + 1}</div>
            <div class="retro-level-title" title="${levelData.title}">${levelData.title}</div>
            <div class="text-xs text-gray-400 mt-1 mb-2 level-description truncate" title="${levelData.description}">${levelData.description}</div>
            ${this.renderStarsHTML(stars)}
            ${highScore > 0 ? `<div class="text-xs text-yellow-300 mt-1">最高分: ${highScore}</div>` : ''}
            ${!isUnlocked ? `<div class="text-xs text-red-400 mt-2">🔒 ${unlockReqText}</div>` : ''}
        `;

        if (isUnlocked) {
            card.addEventListener('click', () => this.selectLevel(levelData));
        } else {
            card.title = `未解锁: ${unlockReqText}`;
        }
        return card;
    }

    renderStarsHTML(starCount) {
        let starsHtml = '<div class="retro-stars">';
        for (let i = 0; i < 3; i++) {
            starsHtml += `<div class="retro-star ${i < starCount ? 'filled' : ''}">★</div>`;
        }
        starsHtml += '</div>';
        return starsHtml;
    }

    isLevelUnlocked(levelData, levelIndex) {
        if (levelIndex === 0) return true; // First level always unlocked

        // Check if previous level is completed (has any score > 0 or is in completedLevels array)
        const prevLevel = this.levelsData[levelIndex - 1];
        if (!prevLevel) return false; // Should not happen
        
        // 修改这里：第一关和第二关都默认解锁
        if (levelIndex <= 1) return true;
        
        const prevLevelCompletion = this.getLevelCompletionData(prevLevel.id);
        return prevLevelCompletion.isCompleted;
    }

    getLevelCompletionData(levelId) {
        const completedLevels = this.app.gameState.completedLevels || []; // Array of level IDs that have been completed at least once
        const levelScores = this.app.gameState.levelScores || {}; // { levelId: bestScore }

        const score = levelScores[levelId] || 0;
        let stars = 0;
        const thresholds = window.GAME_DATA.scoring.starThresholds;
        if (score >= thresholds[3]) stars = 3;
        else if (score >= thresholds[2]) stars = 2;
        else if (score >= thresholds[1]) stars = 1;
        
        // A level is considered completed if it has a score > 0 OR if it's in the completedLevels array
        // (completedLevels might be used for story progression beyond just score)
        const isCompleted = score > 0 || completedLevels.includes(levelId);

        return { score, stars, isCompleted };
    }

    selectLevel(levelData) { // Called when a player clicks on an unlocked level card
        console.log(`🎯 选择关卡: ${levelData.title}`);
        this.showLevelPreviewModal(levelData);
    }

    showLevelPreviewModal(levelData) {
        const completionData = this.getLevelCompletionData(levelData.id);
        const content = `
            <div class="level-preview-modal text-left">
                <div class="text-center mb-4">
                    <h3 class="text-xl font-bold mb-1 text-cyan-300">${levelData.title}</h3>
                    ${this.renderStarsHTML(completionData.stars)}
                    ${completionData.score > 0 ? `<p class="text-sm text-yellow-400">最高分: ${completionData.score}</p>` : ''}
                </div>

                <div class="retro-video-frame mb-4 h-32 sm:h-40 bg-black flex items-center justify-center">
                    <div class="video-clip-icon play text-5xl text-green-400">🎬</div>
                    <p class="absolute bottom-2 text-xs text-gray-500">视频预览区</p>
                </div>
                
                <p class="text-sm text-gray-300 mb-3 leading-relaxed">${levelData.description}</p>
                <div class="text-xs text-gray-400 mb-4 space-y-1">
                    <p><strong>挑战详情:</strong> ${levelData.challengeDetails || '暂无详细说明。'}</p>
                    <p><strong>难度:</strong> <span class="font-bold text-yellow-300">${levelData.difficulty || '未知'}</span></p>
                    <p><strong>时长:</strong> ${levelData.duration || '未知'}</p>
                    <p><strong>提示点数量:</strong> ${levelData.scoringTargets?.length || 0}个</p>
                </div>

                <div class="grid grid-cols-2 gap-3 sm:gap-4 mt-5">
                    <button class="retro-button secondary w-full level-preview-cancel"><span class="retro-button-text">返回</span></button>
                    <button class="retro-submit-button w-full level-preview-start"><span class="retro-button-text">开始挑战!</span></button>
                </div>
            </div>
        `;

        this.app.menu.showModal(`关卡详情: ${levelData.title}`, content, (modalElement) => {
            const cancelBtn = modalElement.querySelector('.level-preview-cancel');
            const startBtn = modalElement.querySelector('.level-preview-start');

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.app.menu.hideModal());
            }
            if (startBtn) {
                startBtn.addEventListener('click', () => {
                    this.app.menu.hideModal(null, () => { // Hide modal then start level
                        this.startLevelGame(levelData);
                    });
                });
            }
        });
    }

    startLevelGame(levelData) { // Starts the actual game scene for the level
        console.log(`🎮 开始游戏关卡: ${levelData.title}`);
        this.app.gameState.currentLevelId = levelData.id; // Store current level ID
        this.app.showScene('game-scene', {
            levelId: levelData.id,
            showLoading: true,
            loadingMessage: `准备关卡: ${levelData.title}`
        });
    }

    completeLevel(levelId, score, stars) {
        if (!this.app.gameState.completedLevels.includes(levelId)) {
            this.app.gameState.completedLevels.push(levelId);
        }

        const currentBest = this.app.gameState.levelScores[levelId] || 0;
        if (score > currentBest) {
            this.app.gameState.levelScores[levelId] = score;
        }
        this.app.saveGameState();
        console.log(`✅ 关卡完成: ${levelId}, 得分: ${score}, 星级: ${stars}`);
        this.refresh(); // Refresh level map to show updated stars/scores
    }

    refresh() { // Refresh the level map display (e.g., after completing a level)
        this.renderLevelMap();
        console.log('🔄 关卡地图已刷新');
    }

    getNextLevelData(currentLevelId) { // Gets data for the next available level
        const currentIndex = this.levelsData.findIndex(level => level.id === currentLevelId);
        if (currentIndex === -1 || currentIndex >= this.levelsData.length - 1) {
            return null; // No current level found or it's the last level
        }
        const nextLevelData = this.levelsData[currentIndex + 1];
        if (this.isLevelUnlocked(nextLevelData, currentIndex + 1)) {
            return nextLevelData;
        }
        return null; // Next level exists but is locked
    }
    
    // Public method for GameManager to use for stars rendering in score modal
    renderStars(starCount) { return this.renderStarsHTML(starCount); }
}

