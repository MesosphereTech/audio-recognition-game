// Game scene management, recording, scoring
class GameManager {
    constructor(app) {
        this.app = app;
        this.currentLevelData = null;
        this.isRecording = false;
        this.isPlaying = false; // Used for both preview and playback
        this.recordedAudio = null;
        this.videoElement = null;

        this.recordingStartTimestamp = 0; // System time (performance.now()) when recording actually started
        this._videoTimelineFrameId = null; // For video timeline updates
        this._audioVisualizationFrameId = null; // For audio visualization updates
        this.levelObjectiveShown = false; // Tracks if objectives for the current level attempt have been shown
        this.playedCueAlerts = new Set(); // Tracks cues for which audio alert has been played this session


        this.selectedItems = []; // IDs of items selected by player

        this.ui = { // Cache UI elements
            levelTitle: document.getElementById('level-title'),
            scoreDisplay: document.getElementById('score-display'), // Global score display in header
            videoPlaceholder: document.getElementById('video-placeholder'),
            videoPlaceholderContent: document.querySelector('#video-placeholder .video-placeholder-content'),
            videoElement: document.getElementById('level-video'),

            currentTimeDisplay: document.getElementById('current-time'),
            totalTimeDisplay: document.getElementById('total-time'),
            timelineProgress: document.getElementById('timeline-progress'),
            timelineCuePoints: document.getElementById('timeline-cue-points'), // Container for cue point markers
            waveformCanvas: document.getElementById('audio-waveform-canvas'),
            audioLevelFill: document.getElementById('audio-level-fill'), // For mic input level meter

            recordBtn: document.getElementById('record-btn'),
            recordText: document.getElementById('record-text'),
            playbackBtn: document.getElementById('playback-btn'),
            submitBtn: document.getElementById('submit-btn'),
            previewBtn: document.getElementById('preview-btn'),

            itemSlotsContainer: document.getElementById('item-slots'),
            selectedItemCountDisplay: document.getElementById('selected-item-count'),
            maxItemsLabel: document.getElementById('max-items-label'),

            // Score breakdown in game scene (for live feedback, currently not live)
            timingScoreDisplay: document.getElementById('timing-score'),
            performanceScoreDisplay: document.getElementById('performance-score'),
            creativityScoreDisplay: document.getElementById('creativity-score'),

            // Score modal elements
            scoreModal: document.getElementById('score-modal'),
            finalStarsDisplay: document.getElementById('final-stars'),
            finalScoreDisplay: document.getElementById('final-score'),
            scoreCommentDisplay: document.getElementById('score-comment'),
            earnedPointsDisplay: document.getElementById('earned-points'),
            retryBtn: document.getElementById('retry-btn'),
            nextLevelBtn: document.getElementById('next-level-btn'),
            
            // Objective Modal (optional, could reuse generic)
            objectiveModal: document.getElementById('objective-modal'),
            objectiveModalTitle: document.getElementById('objective-modal-title'),
            objectiveModalContent: document.getElementById('objective-modal-content'),
            objectiveModalStartBtn: document.getElementById('objective-modal-start-btn'),
        };
        this.videoElement = this.ui.videoElement; // Convenience reference
        this.init();
    }

    init() {
        this.setupEventListeners();
        window.addEventListener('audioanalysisdata', (event) => {
            if (this.isRecording && this._audioVisualizationFrameId) {
                this.updateLiveAudioVisualization(event.detail);
            }
        });
        console.log(`🎮 游戏场景管理器已初始化 (v${window.GAME_DATA.config.version})`);
    }

    setupEventListeners() {
        if (this.ui.recordBtn) this.ui.recordBtn.addEventListener('click', () => this.toggleRecording());
        if (this.ui.playbackBtn) this.ui.playbackBtn.addEventListener('click', () => this.playRecordingWithSync());
        if (this.ui.submitBtn) this.ui.submitBtn.addEventListener('click', () => this.submitDubbing());
        if (this.ui.previewBtn) this.ui.previewBtn.addEventListener('click', () => this.previewLevelVideo());
        if (this.ui.objectiveModalStartBtn) this.ui.objectiveModalStartBtn.addEventListener('click', () => this.startRecordingAfterObjective());

    }

    loadLevel(levelId) {
        this.currentLevelData = window.GAME_DATA.levels.find(l => l.id === levelId);
        if (!this.currentLevelData) {
            console.error(`关卡数据未找到: ${levelId}`);
            this.app.showNotification(`无法加载关卡 ${levelId}`, 'error');
            this.app.showScene('level-select');
            return;
        }
        console.log(`🎬 正在加载关卡: ${this.currentLevelData.title}`);
        this.resetGameStateForNewLevel();
        this.updateUIForLevel();
        this.loadLevelVideo(this.currentLevelData.videoUrl);
    }

    renderCuePoints() {
        if (!this.ui.timelineCuePoints || !this.currentLevelData || !this.currentLevelData.scoringTargets || !this.videoElement || !this.videoElement.duration) {
            if(this.ui.timelineCuePoints) this.ui.timelineCuePoints.innerHTML = '';
            return;
        }
        this.ui.timelineCuePoints.innerHTML = '';
        const videoDuration = this.videoElement.duration;

        this.currentLevelData.scoringTargets.forEach(target => {
            const marker = document.createElement('div');
            marker.className = 'cue-point-marker';
            const positionPercent = (target.time / videoDuration) * 100;
            marker.style.left = `${GAME_UTILS.clamp(positionPercent, 0, 100)}%`;
            marker.title = `${target.description || '关键提示点'} @ ${this.formatTime(target.time)} (类型: ${target.expectedType || '任意'})`;
            
            // Add an inner element for better visual styling potential
            const innerMarker = document.createElement('div');
            innerMarker.className = 'cue-point-marker-inner';
            marker.appendChild(innerMarker);

            marker.dataset.time = target.time; // Store time for potential animation
            this.ui.timelineCuePoints.appendChild(marker);
        });
        console.log(`${this.currentLevelData.scoringTargets.length} cue points rendered.`);
    }


    loadLevelVideo(videoUrl) {
         if (!this.videoElement) {
             console.error("Video element not found!");
             this.showVideoPlaceholder('error', '视频播放器加载失败。');
             return;
         }
         this.showVideoPlaceholder('loading', '视频加载中...');
         if (this.ui.videoPlaceholder) this.ui.videoPlaceholder.classList.remove('hidden');
         this.videoElement.classList.add('hidden');

         this.videoElement.src = videoUrl;
         this.videoElement.preload = 'auto';
         this.videoElement.load();

         this.videoElement.onloadedmetadata = () => {
             console.log(`Video metadata loaded: ${videoUrl}, Duration: ${this.videoElement.duration}s`);
             if (this.ui.totalTimeDisplay) this.ui.totalTimeDisplay.textContent = this.formatTime(this.videoElement.duration);
             if (!this.currentLevelData.duration_seconds || Math.abs(this.currentLevelData.duration_seconds - this.videoElement.duration) > 1) {
                  this.currentLevelData.duration_seconds = this.videoElement.duration;
                  console.warn(`关卡数据时长已更新为视频实际时长: ${this.currentLevelData.duration_seconds.toFixed(1)}s`);
             }
             this.showVideoPlaceholder('initial', this.currentLevelData.description);
             this.videoElement.classList.remove('hidden');
             if(this.ui.previewBtn) this.ui.previewBtn.disabled = false;
             if(this.ui.recordBtn) this.ui.recordBtn.disabled = false;
             this.renderCuePoints();
         };
         this.videoElement.onerror = (e) => {
             console.error("Error loading video:", this.videoElement.error, e);
             const errorMsg = this.videoElement.error ? `${this.videoElement.error.message} (code ${this.videoElement.error.code})` : '未知视频错误';
             this.showVideoPlaceholder('error', `视频加载失败: ${errorMsg}`);
             if (this.ui.videoPlaceholder) this.ui.videoPlaceholder.classList.remove('hidden');
             this.videoElement.classList.add('hidden');
             if(this.ui.previewBtn) this.ui.previewBtn.disabled = true;
             if(this.ui.recordBtn) this.ui.recordBtn.disabled = true;
             this.app.showNotification('视频文件加载失败，请检查路径或网络连接。', 'error');
         };
         this.videoElement.oncanplay = () => {
             if(this.ui.previewBtn) this.ui.previewBtn.disabled = false;
             if(this.ui.recordBtn) this.ui.recordBtn.disabled = false;
         };
    }

    resetGameStateForNewLevel() {
        this.isRecording = false;
        this.isPlaying = false;
        this.recordedAudio = null;
        this.recordingStartTimestamp = 0;
        this.selectedItems = [];
        this.levelObjectiveShown = false; // Reset for new level
        this.playedCueAlerts.clear(); // Clear played cue alerts

        if(this.ui.recordBtn) { this.ui.recordBtn.classList.remove('recording'); this.ui.recordBtn.disabled = true; this.ui.recordBtn.title = "视频加载后可录音"; }
        if(this.ui.recordText) this.ui.recordText.textContent = '开始狂嚎!';
        if(this.ui.playbackBtn) { this.ui.playbackBtn.disabled = true; this.ui.playbackBtn.title = "录音后可试听"; }
        if(this.ui.submitBtn) { this.ui.submitBtn.disabled = true; this.ui.submitBtn.title = "录音并选择物品后可提交"; }
        if(this.ui.previewBtn) { this.ui.previewBtn.disabled = true; this.ui.previewBtn.title = "视频加载后可预览"; }

        if(this.ui.timelineProgress) this.ui.timelineProgress.style.width = '0%';
        if(this.ui.currentTimeDisplay) this.ui.currentTimeDisplay.textContent = '0:00';
        if(this.ui.timelineCuePoints) this.ui.timelineCuePoints.innerHTML = '';

        this.clearAudioVisualization();

        if(this.ui.timingScoreDisplay) this.ui.timingScoreDisplay.textContent = '--';
        if(this.ui.performanceScoreDisplay) this.ui.performanceScoreDisplay.textContent = '--';
        if(this.ui.creativityScoreDisplay) this.ui.creativityScoreDisplay.textContent = '--';

        this.updateSelectedItemDisplay();

        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.currentTime = 0;
        }
         if (this.ui.scoreModal && this.ui.scoreModal.classList.contains('active')) {
              this.app.menu.hideModal(this.ui.scoreModal);
         }
         if (this.ui.objectiveModal && this.ui.objectiveModal.classList.contains('active')) {
            this.app.menu.hideModal(this.ui.objectiveModal);
        }
    }

    updateUIForLevel() {
        if (this.ui.levelTitle) {
            this.ui.levelTitle.textContent = this.currentLevelData.title;
            this.ui.levelTitle.title = this.currentLevelData.title;
        }
        const duration = this.videoElement?.duration || this.currentLevelData?.duration_seconds || 0;
        if (this.ui.totalTimeDisplay) this.ui.totalTimeDisplay.textContent = this.formatTime(duration);
        if (this.ui.maxItemsLabel) this.ui.maxItemsLabel.textContent = window.GAME_DATA.config.maxSimultaneousItems || 3;

        this.populateItemSlots();

        const videoReady = this.videoElement?.readyState >= HTMLMediaElement.HAVE_METADATA;
        if(this.ui.previewBtn) { this.ui.previewBtn.disabled = !videoReady; this.ui.previewBtn.title = videoReady ? "预览关卡视频" : "视频加载中...";}
        if(this.ui.recordBtn) { this.ui.recordBtn.disabled = !videoReady; this.ui.recordBtn.title = videoReady ? "开始或停止录音" : "视频加载中...";}
    }

    populateItemSlots() {
        if (!this.ui.itemSlotsContainer) return;
        this.ui.itemSlotsContainer.innerHTML = '';
        const availableItems = this.app.gameState.unlockedItems;
        const maxSlots = window.GAME_DATA.config.maxSimultaneousItems || 3;

        let itemsToDisplay = [];
        const levelInitialItems = this.currentLevelData.initialItems || [];
        levelInitialItems.forEach(itemId => {
            if (availableItems.includes(itemId) && !itemsToDisplay.includes(itemId)) {
                itemsToDisplay.push(itemId);
            }
        });
        availableItems.forEach(itemId => {
            if (!itemsToDisplay.includes(itemId) && itemsToDisplay.length < maxSlots) {
                itemsToDisplay.push(itemId);
            }
        });
        if (itemsToDisplay.length < maxSlots) {
            availableItems.forEach(itemId => {
                if (!itemsToDisplay.includes(itemId) && itemsToDisplay.length < maxSlots) {
                    itemsToDisplay.push(itemId);
                }
            });
        }
        itemsToDisplay = itemsToDisplay.slice(0, maxSlots);

        itemsToDisplay.forEach(itemId => {
            const itemData = window.GAME_DATA.items[itemId];
            if (itemData) {
                const slot = document.createElement('div');
                slot.className = 'retro-item-slot';
                slot.dataset.itemId = itemId;
                slot.title = `${itemData.name}: ${itemData.description}`;
                slot.innerHTML = `
                    <img src="${itemData.icon}" alt="${itemData.name}" class="retro-item-icon">
                    <div class="retro-item-name">${itemData.name}</div>`;
                slot.addEventListener('click', () => this.toggleSelectItem(itemId, slot));
                this.ui.itemSlotsContainer.appendChild(slot);
            }
        });

         const currentSlotCount = this.ui.itemSlotsContainer.children.length;
         for (let i = currentSlotCount; i < maxSlots; i++) {
              const slot = document.createElement('div');
              slot.className = 'retro-item-slot locked';
              slot.innerHTML = `<div class="text-xs text-gray-500 text-center leading-tight">槽位 ${i+1}<br>(可选物品)</div>`;
              slot.title = "从仓库解锁更多物品或选择一个已解锁物品";
              this.ui.itemSlotsContainer.appendChild(slot);
         }
         this.updateSelectedItemDisplay();
    }

    toggleSelectItem(itemId, slotElement) {
        if (this.isRecording || this.isPlaying) {
             this.app.showNotification("录音或回放时无法更换物品!", 'error');
             return;
        }
        this.app.playUISound('item_select');
        const maxItems = window.GAME_DATA.config.maxSimultaneousItems || 3;
        const itemIndex = this.selectedItems.indexOf(itemId);

        if (itemIndex > -1) {
            this.selectedItems.splice(itemIndex, 1);
            slotElement.classList.remove('selected');
        } else {
            if (this.selectedItems.length < maxItems) {
                this.selectedItems.push(itemId);
                slotElement.classList.add('selected');
            } else {
                this.app.showNotification(`最多只能选择 ${maxItems} 个物品! 请先取消一个已选物品。`, 'error');
                return;
            }
        }
        this.updateSelectedItemDisplay();
    }

    updateSelectedItemDisplay() {
        if(this.ui.selectedItemCountDisplay) this.ui.selectedItemCountDisplay.textContent = this.selectedItems.length;
        const canSubmit = this.recordedAudio && this.recordedAudio.blob.size > 0 && this.selectedItems.length > 0;
        if(this.ui.submitBtn) {
            this.ui.submitBtn.disabled = !canSubmit;
            if (!this.recordedAudio || this.recordedAudio.blob.size === 0) {
                this.ui.submitBtn.title = "请先录音";
            } else if (this.selectedItems.length === 0) {
                this.ui.submitBtn.title = "请至少选择一个物品";
            } else {
                this.ui.submitBtn.title = "提交您的配音作品进行评分";
            }
        }
    }
    refreshItemSlots() { this.populateItemSlots(); }

    showVideoPlaceholder(state, message = '') {
         if (!this.ui.videoPlaceholder || !this.ui.videoPlaceholderContent) return;
         const isOverlay = ['preview', 'recording', 'playback', 'processing'].includes(state) ||
                           (state === 'initial' && this.videoElement?.readyState >= HTMLMediaElement.HAVE_METADATA);

         if (isOverlay) {
             if(this.videoElement) this.videoElement.classList.remove('hidden');
             this.ui.videoPlaceholder.classList.add('overlay');
             this.ui.videoPlaceholder.classList.remove('hidden');
         } else {
             if(this.videoElement) this.videoElement.classList.add('hidden');
             this.ui.videoPlaceholder.classList.remove('overlay', 'hidden');
         }
         if (this.videoElement) this.videoElement.controls = false;

        let content = '', icon = '';
        this.ui.videoPlaceholder.className = 'retro-video-frame w-full absolute inset-0 z-10';
        if (isOverlay) this.ui.videoPlaceholder.classList.add('overlay');

        switch(state) {
            case 'loading': icon = '⏳'; content = `<div class="retro-loader-spinner !w-12 !h-12 !border-4 mx-auto mb-2"></div><p class="text-lg text-cyan-300">${message || '加载中...'}</p>`; this.ui.videoPlaceholder.classList.add('video-state-loading'); break;
            case 'initial': icon = '🎬'; content = `<div class="video-clip-icon play text-6xl mb-2">${icon}</div><h3 class="text-lg font-bold">${this.currentLevelData?.title || '关卡'}</h3><p class="text-sm text-gray-400">${message || this.currentLevelData?.description || '准备好你的声音！'}</p><p class="mt-2 text-xs text-yellow-300">点击“预览”或“开始狂嚎”！</p>`; this.ui.videoPlaceholder.classList.add('video-state-initial'); break;
            case 'preview': icon = '🍿'; content = `<div class="video-clip-anim preview text-6xl mb-2">${icon}</div><p class="text-lg text-cyan-300">视频预览中...</p><p class="text-sm text-gray-400">${message || '注意关键节点。'}</p>`; this.ui.videoPlaceholder.classList.add('video-state-preview'); break;
            case 'recording': icon = '🔴'; content = `<div class="video-clip-anim recording text-6xl mb-2">${icon}</div><p class="text-lg text-red-400">录音进行中!</p><p class="text-sm text-gray-400">尽情发挥！</p>`; this.ui.videoPlaceholder.classList.add('video-state-recording'); break;
            case 'playback': icon = '🎧'; content = `<div class="video-clip-anim playback text-6xl mb-2">${icon}</div><p class="text-lg text-purple-300">回放录音中...</p>`; this.ui.videoPlaceholder.classList.add('video-state-playback'); break;
            case 'processing': icon = '⚙️'; content = `<div class="video-clip-anim processing text-6xl mb-2">${icon}</div><p class="text-lg text-yellow-300">处理配音中...</p><p class="text-sm text-gray-400">精彩表演打分中!</p>`; this.ui.videoPlaceholder.classList.add('video-state-processing'); break;
            case 'error': icon = '❌'; content = `<div class="video-clip-icon error text-6xl mb-2">${icon}</div><p class="text-lg text-red-400">错误</p><p class="text-sm text-gray-400">${message || '发生错误，请重试。'}</p>`; this.ui.videoPlaceholder.classList.add('video-state-error'); break;
            default: content = `<p class="text-gray-500">未知状态</p>`; this.ui.videoPlaceholder.classList.add('video-state-initial');
        }
        this.ui.videoPlaceholderContent.innerHTML = content;
    }

    previewLevelVideo() {
        if (!this.videoElement || this.videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || this.isPlaying || this.isRecording) {
            this.app.showNotification("无法预览：视频未就绪或正在操作。", "error"); return;
        }
        this.app.playUISound('video_preview_start');
        this.showVideoPlaceholder('preview');
        this.isPlaying = true;
        if(this.ui.previewBtn) this.ui.previewBtn.disabled = true;
        if(this.ui.recordBtn) this.ui.recordBtn.disabled = true;

        this.videoElement.currentTime = 0;
        this.videoElement.play()
            .then(() => { this.startVideoTimelineUpdate(); })
            .catch(error => {
                console.error("Video preview failed:", error); this.app.showNotification("视频预览失败。", "error");
                this.isPlaying = false; this.clearVideoTimelineUpdate(); this.showVideoPlaceholder('initial', '预览失败。');
                if(this.ui.previewBtn) this.ui.previewBtn.disabled = !(this.videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA);
                if(this.ui.recordBtn) this.ui.recordBtn.disabled = !(this.videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA);
            });

        this.videoElement.onended = () => {
            this.isPlaying = false; this.clearVideoTimelineUpdate();
            this.showVideoPlaceholder('initial', '预览结束。');
            if(this.ui.timelineProgress) this.ui.timelineProgress.style.width = '0%';
            if(this.ui.currentTimeDisplay) this.ui.currentTimeDisplay.textContent = this.formatTime(0);
            if(this.ui.previewBtn) this.ui.previewBtn.disabled = false;
            if(this.ui.recordBtn) this.ui.recordBtn.disabled = false;
        };
    }

    showObjectiveModal() {
        if (!this.currentLevelData || !this.ui.objectiveModal || !this.ui.objectiveModalTitle || !this.ui.objectiveModalContent) {
            this.startRecordingAfterObjective(); // Fallback if modal elements are missing
            return;
        }
        this.ui.objectiveModalTitle.textContent = `关卡目标: ${this.currentLevelData.title}`;
        // Sanitize or carefully construct HTML if challengeDetails can contain HTML
        const challengeDetailsHtml = (this.currentLevelData.challengeDetails || "开始你的表演！")
            .replace(/\n/g, '<br>')
            .replace(/(@\d+(\.\d+)?s)/g, '<strong class="text-yellow-300">$1</strong>') // Highlight time cues
            .replace(/(目标：|关键音效：|情感基调：|情感：)/g, '<strong class="text-cyan-300">$1</strong>'); // Highlight keywords

        this.ui.objectiveModalContent.innerHTML = `<p class="text-sm leading-relaxed">${challengeDetailsHtml}</p>`;
        this.app.menu.showModalDirectly(this.ui.objectiveModal);
    }

    async startRecordingAfterObjective() {
        if (this.ui.objectiveModal && this.ui.objectiveModal.classList.contains('active')) {
            this.app.menu.hideModal(this.ui.objectiveModal);
        }
        this.levelObjectiveShown = true;

        this.videoElement.currentTime = 0;
        this.recordedAudio = null;
        if(this.ui.playbackBtn) { this.ui.playbackBtn.disabled = true; this.ui.playbackBtn.title = "录音后可试听"; }
        if(this.ui.submitBtn) { this.ui.submitBtn.disabled = true; this.ui.submitBtn.title = "录音并选择物品后可提交"; }
        if(this.ui.previewBtn) this.ui.previewBtn.disabled = true;

        try {
            await this.app.audio.startRecording();
            this.isRecording = true;
            this.recordingStartTimestamp = performance.now();
            if(this.ui.recordBtn) this.ui.recordBtn.classList.add('recording');
            if(this.ui.recordText) this.ui.recordText.textContent = '录音中...停止';
            this.app.playUISound('record_start');
            this.showVideoPlaceholder('recording');
            this.startAudioVisualizationLoop();

            this.videoElement.play()
                .then(() => { this.startVideoTimelineUpdate(); })
                .catch(videoError => {
                     console.error("录音时视频播放失败:", videoError);
                     this.app.showNotification("视频播放失败，录音已停止。", "error");
                     this.app.audio.stopRecording().catch(e => console.warn("Error stopping audio after video play fail:", e));
                     this.isRecording = false; this.clearVideoTimelineUpdate(); this.stopAudioVisualizationLoop();
                     if(this.ui.recordBtn) this.ui.recordBtn.classList.remove('recording');
                     if(this.ui.recordText) this.ui.recordText.textContent = '开始狂嚎!';
                     if(this.ui.previewBtn) this.ui.previewBtn.disabled = false;
                     this.showVideoPlaceholder('error', '视频播放问题导致录音失败。');
                });
        } catch (error) {
            this.isRecording = false;
            if(this.ui.recordBtn) this.ui.recordBtn.classList.remove('recording');
            if(this.ui.recordText) this.ui.recordText.textContent = '开始狂嚎!';
            if(this.ui.previewBtn) this.ui.previewBtn.disabled = false;
            this.showVideoPlaceholder('error', `录音启动失败: ${error.message}`);
        }
    }

    async toggleRecording() {
        if (!this.videoElement || this.videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || this.isPlaying) {
             const reason = !this.videoElement || this.videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ? "视频未准备好。" : "正在预览或回放。";
             this.app.showNotification(`无法录音: ${reason}`, "error"); return;
        }

        if (this.isRecording) { // --- STOP RECORDING ---
            this.isRecording = false;
            if(this.ui.recordBtn) this.ui.recordBtn.classList.remove('recording');
            if(this.ui.recordText) this.ui.recordText.textContent = '处理中...';
            if(this.ui.recordBtn) this.ui.recordBtn.disabled = true;
            this.videoElement.pause();
            this.clearVideoTimelineUpdate();
            this.stopAudioVisualizationLoop();

            try {
                const audioData = await this.app.audio.stopRecording();
                this.recordedAudio = audioData;
                if (this.recordedAudio && this.recordedAudio.blob.size > 0) {
                    console.log("录音完成, 时长: ", this.recordedAudio.duration.toFixed(2) + "s");
                    if(this.ui.playbackBtn) { this.ui.playbackBtn.disabled = false; this.ui.playbackBtn.title = "试听您的录音"; }
                    this.updateSelectedItemDisplay();
                    this.showVideoPlaceholder('initial', '录音完成！可试听或提交。');
                    this.app.playUISound('success_minor'); // Sound for successful recording stop
                } else {
                     this.app.showNotification(this.recordedAudio && this.recordedAudio.blob.size === 0 ? "录音数据为空，请重试。" : "录音数据处理失败。", "error");
                     if(this.ui.playbackBtn) { this.ui.playbackBtn.disabled = true; this.ui.playbackBtn.title = "录音失败，无法试听"; }
                     this.showVideoPlaceholder('error', '录音失败或数据无效。');
                }
            } catch (error) {
                console.error("停止录音流程失败:", error);
                this.app.showNotification(error.message || "停止录音失败。", "error");
                this.recordedAudio = null;
                if(this.ui.playbackBtn) { this.ui.playbackBtn.disabled = true; this.ui.playbackBtn.title = "录音失败，无法试听"; }
                this.showVideoPlaceholder('error', '停止录音时发生错误。');
            } finally {
                if(this.ui.recordText) this.ui.recordText.textContent = '开始狂嚎!';
                if(this.ui.recordBtn && this.videoElement?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                    this.ui.recordBtn.disabled = false;
                    this.ui.recordBtn.title = "开始或停止录音";
                }
                this.videoElement.currentTime = 0;
                if(this.ui.timelineProgress) this.ui.timelineProgress.style.width = '0%';
                if(this.ui.currentTimeDisplay) this.ui.currentTimeDisplay.textContent = this.formatTime(0);
                this.updateSelectedItemDisplay();
            }
        } else { // --- START RECORDING ---
            if (!this.levelObjectiveShown) {
                this.showObjectiveModal();
            } else {
                this.startRecordingAfterObjective();
            }
        }
    }

    startVideoTimelineUpdate() {
        this.clearVideoTimelineUpdate();
        const update = () => {
            if (!this.isPlaying && !this.isRecording) {
                this.clearVideoTimelineUpdate(); return;
            }
            if (this.videoElement && (this.videoElement.duration > 0)) {
                const currentTime = this.videoElement.currentTime;
                const duration = this.videoElement.duration;
                const percent = (currentTime / duration) * 100;
                if(this.ui.timelineProgress) this.ui.timelineProgress.style.width = `${percent}%`;
                if(this.ui.currentTimeDisplay) this.ui.currentTimeDisplay.textContent = this.formatTime(currentTime);

                // Cue point audio alerts & visual feedback
                if (this.currentLevelData && this.currentLevelData.scoringTargets) {
                    this.currentLevelData.scoringTargets.forEach(target => {
                        const cueTime = target.time;
                        const alertWindowStart = cueTime - 1.0; // Play alert 1s before
                        const alertWindowEnd = cueTime - 0.5;   // Up to 0.5s before

                        const markerEl = this.ui.timelineCuePoints.querySelector(`.cue-point-marker[data-time="${target.time}"]`);

                        if (currentTime >= alertWindowStart && currentTime < cueTime && !this.playedCueAlerts.has(cueTime)) {
                            this.app.audio.playSFX('cue_point_alert');
                            this.playedCueAlerts.add(cueTime);
                            if(markerEl) markerEl.classList.add('active-cue-alert'); // Visual cue for alert
                        }
                        // Highlight marker when video is at the exact cue point (or very close)
                        if (Math.abs(currentTime - cueTime) < 0.25) {
                            if(markerEl) markerEl.classList.add('active-cue-now');
                        } else {
                            if(markerEl) markerEl.classList.remove('active-cue-now');
                        }
                        // Remove alert highlight after cue passed
                        if (currentTime > cueTime && markerEl && markerEl.classList.contains('active-cue-alert')) {
                           markerEl.classList.remove('active-cue-alert');
                        }
                    });
                }


                if (this.isRecording && currentTime >= duration - 0.15) {
                    console.log("Video ended during recording, auto-stopping.");
                    this.toggleRecording();
                }
            }
            this._videoTimelineFrameId = requestAnimationFrame(update);
        };
        this._videoTimelineFrameId = requestAnimationFrame(update);
    }
    clearVideoTimelineUpdate() {
        if (this._videoTimelineFrameId) cancelAnimationFrame(this._videoTimelineFrameId);
        this._videoTimelineFrameId = null;
         // Reset visual cues on timeline markers
        if (this.ui.timelineCuePoints) {
            this.ui.timelineCuePoints.querySelectorAll('.cue-point-marker').forEach(marker => {
                marker.classList.remove('active-cue-alert', 'active-cue-now');
            });
        }
    }

    updateLiveAudioVisualization(detail) {
        if (!this.ui.waveformCanvas || !this.app.audio.analyser) return;
        const canvas = this.ui.waveformCanvas;
        const canvasCtx = canvas.getContext('2d');

        if(this.ui.audioLevelFill) this.ui.audioLevelFill.style.width = `${GAME_UTILS.clamp(detail.volume, 0, 100)}%`;

        const dataArrayTime = detail.timeDomainData;
        const bufferLengthTime = dataArrayTime.length;

        canvasCtx.fillStyle = 'rgba(16, 12, 15, 0.6)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'var(--retro-pink)';
        canvasCtx.beginPath();
        const sliceWidth = canvas.width * 1.0 / bufferLengthTime;
        let x = 0;
        for(let i = 0; i < bufferLengthTime; i++) {
            const v = dataArrayTime[i] / 128.0;
            const y = (v -1) * (canvas.height / 2.2) + canvas.height/2;
            if (i === 0) canvasCtx.moveTo(x, y); else canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height/2);
        canvasCtx.stroke();
    }

    startAudioVisualizationLoop() {
         if (this._audioVisualizationFrameId || !this.app.audio.analyser) return;
         this._audioVisualizationFrameId = 1;
         console.log("🚀 开始音频可视化 (依赖 AudioManager's analysis loop & events)");
     }

     stopAudioVisualizationLoop() {
         this._audioVisualizationFrameId = null;
         console.log("⏸️ 停止音频可视化");
     }

     clearAudioVisualization() {
        if(this.ui.audioLevelFill) this.ui.audioLevelFill.style.width = '0%';
        const canvas = this.ui.waveformCanvas;
        if (canvas) {
            const canvasCtx = canvas.getContext('2d');
            canvasCtx.fillStyle = 'rgba(16, 12, 15, 0.8)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            canvasCtx.lineWidth = 1;
            canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            canvasCtx.beginPath();
            canvasCtx.moveTo(0, canvas.height / 2);
            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke();
        }
    }

    async playRecordingWithSync() {
        if (!this.videoElement || this.videoElement.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
            !this.recordedAudio || !this.recordedAudio.blob || this.recordedAudio.blob.size === 0 ||
            this.isRecording || this.isPlaying) {
            this.app.showNotification("无法回放：视频未就绪、无有效录音或正在操作。", "error");
            return;
        }
        this.app.playUISound('video_playback_start');
        this.showVideoPlaceholder('playback');
        this.isPlaying = true;
        this.stopAudioVisualizationLoop();
        this.clearAudioVisualization();

        if(this.ui.playbackBtn) this.ui.playbackBtn.disabled = true;
        if(this.ui.recordBtn) this.ui.recordBtn.disabled = true;
        if(this.ui.submitBtn) this.ui.submitBtn.disabled = true;
        if(this.ui.previewBtn) this.ui.previewBtn.disabled = true;

        if (this.recordedAudio.audioBuffer) {
            this.drawStaticRecordedWaveform(this.recordedAudio.audioBuffer);
        } else {
            console.warn("No AudioBuffer in recordedAudio, cannot draw static waveform for playback.");
        }

        try {
            await this.app.audio.playRecording(this.recordedAudio, this.videoElement);
            console.log("录音同步回放完成或被中断。");
        } catch (error) {
            console.error("录音同步回放失败:", error);
            this.app.showNotification(error.message || "录音回放时发生错误。", "error");
        } finally {
            this.isPlaying = false;
            this.clearVideoTimelineUpdate();
            this.showVideoPlaceholder('initial', '试听结束。');
            if(this.ui.playbackBtn && this.recordedAudio && this.recordedAudio.blob.size > 0) this.ui.playbackBtn.disabled = false;
            if(this.ui.recordBtn && this.videoElement?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) this.ui.recordBtn.disabled = false;
            this.updateSelectedItemDisplay();
            if(this.ui.previewBtn && this.videoElement?.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) this.ui.previewBtn.disabled = false;

            if (this.videoElement) this.videoElement.currentTime = 0;
            if(this.ui.timelineProgress) this.ui.timelineProgress.style.width = '0%';
            if(this.ui.currentTimeDisplay) this.ui.currentTimeDisplay.textContent = this.formatTime(0);
            this.clearAudioVisualization();
        }
    }

    drawStaticRecordedWaveform(audioBuffer) {
        if (!audioBuffer || !this.ui.waveformCanvas) {
            console.warn("Cannot draw static waveform: no AudioBuffer or canvas.");
            return;
        }
        const canvas = this.ui.waveformCanvas;
        const ctx = canvas.getContext('2d');
        const channelData = audioBuffer.getChannelData(0);
        const numSamples = channelData.length;
        const sliceWidth = canvas.width / numSamples;

        ctx.fillStyle = 'rgba(16, 12, 15, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'var(--retro-purple)';
        ctx.beginPath();

        let x = 0;
        for (let i = 0; i < numSamples; i++) {
            const y = (channelData[i] * (canvas.height / 2.5)) + (canvas.height / 2);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.stroke();
        console.log("静态录制波形已绘制。");
    }


    submitDubbing() {
        if (!this.recordedAudio || !this.recordedAudio.blob || this.recordedAudio.blob.size === 0 ||
            this.isRecording || this.isPlaying || this.selectedItems.length === 0) {
            const message = (!this.recordedAudio || !this.recordedAudio.blob || this.recordedAudio.blob.size === 0) ? "请先有效录音！" :
                            this.selectedItems.length === 0 ? "请至少选择一个物品！" : "当前操作进行中，请稍候！";
            this.app.showNotification(message, "error"); return;
        }
        this.app.playUISound('submit_success');
        this.showVideoPlaceholder('processing', '正在分析您的神级配音...');
        if(this.ui.recordBtn) this.ui.recordBtn.disabled = true;
        if(this.ui.playbackBtn) this.ui.playbackBtn.disabled = true;
        if(this.ui.submitBtn) this.ui.submitBtn.disabled = true;
        if(this.ui.previewBtn) this.ui.previewBtn.disabled = true;

        setTimeout(() => {
            const analysisResults = this.app.audio.analyzeAudioCharacteristics(this.recordedAudio, this.selectedItems);
            const { score, timingScoreVal, performanceScoreVal, creativityScoreVal, detailedBreakdown } = this.calculateDetailedScore(analysisResults);

            let stars = 0;
            const thresholds = window.GAME_DATA.scoring.starThresholds;
            if (score >= thresholds[3]) stars = 3;
            else if (score >= thresholds[2]) stars = 2;
            else if (score >= thresholds[1]) stars = 1;

            const scoreConfig = this.currentLevelData.rewards || { baseInspirationPoints: 10, inspirationMultiplier: 0.5 };
            const earnedInspirationPoints = Math.round(scoreConfig.baseInspirationPoints + (score / 100) * (scoreConfig.inspirationMultiplier * 100));

            let comment = window.GAME_DATA.texts.scoreComments.needsWork;
            if (stars === 3) comment = window.GAME_DATA.texts.scoreComments.excellent;
            else if (stars === 2) comment = window.GAME_DATA.texts.scoreComments.good;
            else if (stars >= 1) comment = window.GAME_DATA.texts.scoreComments.fair;

            if(this.ui.timingScoreDisplay) this.ui.timingScoreDisplay.textContent = `${Math.round(timingScoreVal)}/${Math.round(window.GAME_DATA.scoring.weights.timing * 100)}`;
            if(this.ui.performanceScoreDisplay) this.ui.performanceScoreDisplay.textContent = `${Math.round(performanceScoreVal)}/${Math.round(window.GAME_DATA.scoring.weights.performance * 100)}`;
            if(this.ui.creativityScoreDisplay) this.ui.creativityScoreDisplay.textContent = `${Math.round(creativityScoreVal)}/${Math.round(window.GAME_DATA.scoring.weights.creativity * 100)}`;

            if (this.app.levels) this.app.levels.completeLevel(this.currentLevelData.id, score, stars);
            this.app.updateScore(earnedInspirationPoints);
            
            const firstTimeCompletionKey = `${this.currentLevelData.id}_first_reward_claimed`;
            if (this.currentLevelData.rewardsOnCompletion && this.currentLevelData.rewardsOnCompletion.newItemId &&
                !this.app.gameState.completedLevels.includes(firstTimeCompletionKey)) {
                this.app.unlockItem(this.currentLevelData.rewardsOnCompletion.newItemId);
                // No, completedLevels stores IDs of levels completed, not this key. The check should be on whether the item has been unlocked or a similar flag.
                // For simplicity, we assume if the item related to rewardsOnCompletion is NOT YET in unlockedItems, then this is first time.
                // Or, more robustly, check if the specific reward has been claimed. A simple way for this iteration:
                // Check against `this.app.gameState.completedLevels` - this array *should* store level IDs once completed for the *first* time if used for unlocks.
                // The current `completeLevel` in levels.js already adds levelId to `completedLevels`.
                // So, checking `!this.app.gameState.levelScores[this.currentLevelData.id]` (meaning no previous score) might be a simpler first-time check for reward.
                // However, a dedicated "rewardClaimed" flag per level in gameState would be best.
                // For now, rely on `unlockItem`'s internal check to not re-unlock.
                // The `firstTimeCompletionKey` logic in `app.js`'s submitDubbing seems to be for something else or a misunderstanding.
                // Let's assume `unlockItem` handles not re-awarding.
            }

            this.showScoreModal(score, stars, earnedInspirationPoints, comment, detailedBreakdown);
            this.showVideoPlaceholder('initial', '评分完成！查看成绩。');
        }, 1800);
    }

    calculateDetailedScore(analysisResults) {
        console.log("📊 计算详细分数...", analysisResults);
        const scoringConfig = window.GAME_DATA.scoring;
        const levelTargets = this.currentLevelData.scoringTargets || [];
        const recordedDuration = analysisResults.duration;
        const timingTolerance = window.GAME_DATA.config.cuePointTimingTolerance;
        const utils = window.GAME_UTILS;
        const purchasedShopItems = this.app.gameState.purchasedShopItems || [];

        let totalWeightedScore = 0;
        let timingScoreRaw = 0, performanceScoreRaw = 0, creativityScoreRaw = 0;
        let detailedBreakdown = { cues: [], shopEffectsApplied: [] };

        // --- 1. Timing Score ---
        if (levelTargets.length > 0 && analysisResults.rawVolumeData && analysisResults.rawVolumeData.length > 0) {
            let cumulativeCueTimingScore = 0;
            const maxPossibleCueTimingScore = levelTargets.length * scoringConfig.timing.basePointsPerCue;

            levelTargets.forEach((target) => {
                let bestPeakTimeDiff = Infinity;
                let soundEventDetected = false;
                analysisResults.rawVolumeData.forEach(peak => {
                    if (peak.volume > 35) { // Lowered threshold for detection
                        const timeDiff = Math.abs(peak.time - target.time);
                        if (timeDiff < bestPeakTimeDiff) { bestPeakTimeDiff = timeDiff; soundEventDetected = true; }
                    }
                });

                let cueTimingPoints = 0;
                if (soundEventDetected) {
                    if (bestPeakTimeDiff <= timingTolerance * scoringConfig.timing.perfectWindowFactor) cueTimingPoints = scoringConfig.timing.basePointsPerCue;
                    else if (bestPeakTimeDiff <= timingTolerance * scoringConfig.timing.goodWindowFactor) cueTimingPoints = scoringConfig.timing.basePointsPerCue * 0.7;
                    else if (bestPeakTimeDiff <= timingTolerance * scoringConfig.timing.okWindowFactor) cueTimingPoints = scoringConfig.timing.basePointsPerCue * 0.4;
                } else {
                    cueTimingPoints = -scoringConfig.timing.basePointsPerCue * scoringConfig.timing.missPenaltyFactor;
                }
                detailedBreakdown.cues.push({ targetTime: target.time, detectedTimeDiff: soundEventDetected ? bestPeakTimeDiff : null, points: cueTimingPoints * (target.scoreMultiplier || 1.0) });
                cumulativeCueTimingScore += cueTimingPoints * (target.scoreMultiplier || 1.0);
            });
            timingScoreRaw = maxPossibleCueTimingScore > 0 ? (cumulativeCueTimingScore / maxPossibleCueTimingScore) * 100 : (levelTargets.length === 0 ? 100 : 50);
            timingScoreRaw = utils.clamp(timingScoreRaw, 0, 100);
        } else {
            timingScoreRaw = levelTargets.length === 0 ? 100 : 30;
            detailedBreakdown.timingMessage = "无提示点或音频数据不足，基础时机分。";
        }

        // --- 2. Performance Score ---
        let performanceSubScoreTotal = 0;
        let performanceWeightSum = 0;
        const generalTargetPerf = levelTargets.length > 0 ? levelTargets[0] : (this.selectedItems.length > 0 ? window.GAME_DATA.items[this.selectedItems[0]]?.analysisHint : null);
        let currentTargetValueTolerance = scoringConfig.performance.targetValueTolerance;

        // Apply vintage mic tolerance boost FIRST if active
        const vintageMicItem = window.GAME_DATA.shopItems.find(item => item.id === 'shop_vintage_mic');
        if (vintageMicItem && purchasedShopItems.includes('shop_vintage_mic')) {
            currentTargetValueTolerance += vintageMicItem.effect.performanceToleranceBoost || 0;
            detailedBreakdown.shopEffectsApplied.push(`${vintageMicItem.name}: 表现容错提升!`);
        }

        if (generalTargetPerf) {
            let volMatch = utils.calculateRangeMatchScore(analysisResults.volume, generalTargetPerf.volume.min, generalTargetPerf.volume.max, currentTargetValueTolerance) * 100;
            performanceSubScoreTotal += volMatch * scoringConfig.performance.volumeMatchWeight;
            performanceWeightSum += scoringConfig.performance.volumeMatchWeight;
            detailedBreakdown.volumeMatch = volMatch.toFixed(1);

            let pitchMatch = utils.calculateRangeMatchScore(analysisResults.pitchVariation, generalTargetPerf.pitchVariation.min, generalTargetPerf.pitchVariation.max, currentTargetValueTolerance) * 100;
            performanceSubScoreTotal += pitchMatch * scoringConfig.performance.pitchVariationMatchWeight;
            performanceWeightSum += scoringConfig.performance.pitchVariationMatchWeight;
            detailedBreakdown.pitchMatch = pitchMatch.toFixed(1);
            
            let durMatch = utils.calculateRangeMatchScore(recordedDuration, generalTargetPerf.duration?.min, generalTargetPerf.duration?.max, currentTargetValueTolerance + 10) * 100;
            performanceSubScoreTotal += durMatch * scoringConfig.performance.durationMatchWeight;
            performanceWeightSum += scoringConfig.performance.durationMatchWeight;
            detailedBreakdown.durationMatch = durMatch.toFixed(1);

        } else {
            performanceSubScoreTotal += analysisResults.clarity * (scoringConfig.performance.volumeMatchWeight + scoringConfig.performance.pitchVariationMatchWeight + scoringConfig.performance.durationMatchWeight);
            performanceWeightSum += (scoringConfig.performance.volumeMatchWeight + scoringConfig.performance.pitchVariationMatchWeight + scoringConfig.performance.durationMatchWeight);
            detailedBreakdown.performanceMessage = "无特定表现目标，基于清晰度。";
        }
        
        performanceSubScoreTotal += analysisResults.clarity * scoringConfig.performance.clarityWeight;
        performanceWeightSum += scoringConfig.performance.clarityWeight;
        detailedBreakdown.clarity = analysisResults.clarity.toFixed(1);

        if (analysisResults.rhythmDetected && (generalTargetPerf?.rhythmExpected || levelTargets.some(t => t.rhythmExpected))) {
            performanceSubScoreTotal += scoringConfig.performance.rhythmBonusPoints;
            detailedBreakdown.rhythmBonus = scoringConfig.performance.rhythmBonusPoints;
        }
        
        // Bass Boost shop item effect on performance
        const bassBoostItem = window.GAME_DATA.shopItems.find(item => item.id === 'shop_bass_boost');
        if (bassBoostItem && purchasedShopItems.includes('shop_bass_boost')) {
            if (analysisResults.volume >= bassBoostItem.effect.condition.volumeMin && analysisResults.pitchVariation <= bassBoostItem.effect.condition.pitchVariationMax) {
                performanceSubScoreTotal += bassBoostItem.effect.bonusPoints;
                detailedBreakdown.shopEffectsApplied.push(`${bassBoostItem.name}: 低音冲击表现加分 +${bassBoostItem.effect.bonusPoints}!`);
            }
        }
        
        performanceScoreRaw = performanceWeightSum > 0 ? (performanceSubScoreTotal / performanceWeightSum) : 50;
        performanceScoreRaw = utils.clamp(performanceScoreRaw, 0, 100);

        // --- 3. Creativity Score ---
        let creativitySubScore = 0;
        if (analysisResults.estimatedType && this.selectedItems.includes(analysisResults.estimatedType)) {
            creativitySubScore += scoringConfig.creativity.itemFitBonusBase;
            detailedBreakdown.itemFit = scoringConfig.creativity.itemFitBonusBase;
        } else {
            detailedBreakdown.itemFitMessage = `声音似乎与所选物品 (${this.selectedItems.join(', ') || '无'}) 类型 (${analysisResults.estimatedType || '未知'}) 不太匹配。`;
        }
        if (this.selectedItems.length > 1) {
            const comboBonus = (this.selectedItems.length -1) * scoringConfig.creativity.itemComboBonusPerItem;
            creativitySubScore += comboBonus;
            detailedBreakdown.comboBonus = comboBonus;
        }
        const wildness = (analysisResults.pitchVariation > 80 && analysisResults.volume > 70) ? Math.random() * scoringConfig.creativity.wildnessMaxBonus : 0;
        creativitySubScore += wildness;
        detailedBreakdown.wildnessBonus = wildness.toFixed(1);

        // Shop item effects on creativity
        const reverbItem = window.GAME_DATA.shopItems.find(item => item.id === 'shop_reverb_light');
        if (reverbItem && purchasedShopItems.includes('shop_reverb_light')) {
            if (analysisResults.clarity >= reverbItem.effect.condition.clarityMin) {
                creativitySubScore += reverbItem.effect.bonusPoints;
                detailedBreakdown.shopEffectsApplied.push(`${reverbItem.name}: 空间感创意加分 +${reverbItem.effect.bonusPoints}!`);
            }
        }
        if (vintageMicItem && purchasedShopItems.includes('shop_vintage_mic')) { // Already checked for tolerance boost
            creativitySubScore += vintageMicItem.effect.bonusPoints;
            detailedBreakdown.shopEffectsApplied.push(`${vintageMicItem.name}: 复古风格创意加分 +${vintageMicItem.effect.bonusPoints}!`);
        }

        creativityScoreRaw = utils.clamp(creativitySubScore, 0, 100);

        // --- Final Weighted Score ---
        totalWeightedScore = (timingScoreRaw * scoringConfig.weights.timing) +
                             (performanceScoreRaw * scoringConfig.weights.performance) +
                             (creativityScoreRaw * scoringConfig.weights.creativity);
        totalWeightedScore = Math.round(utils.clamp(totalWeightedScore, 0, 100));

        console.log(`详细评分 - 时机: ${timingScoreRaw.toFixed(1)}, 表现: ${performanceScoreRaw.toFixed(1)}, 创意: ${creativityScoreRaw.toFixed(1)}, 总分: ${totalWeightedScore}`);
        detailedBreakdown.finalTiming = timingScoreRaw.toFixed(1);
        detailedBreakdown.finalPerformance = performanceScoreRaw.toFixed(1);
        detailedBreakdown.finalCreativity = creativityScoreRaw.toFixed(1);
        console.log("Applied shop effects:", detailedBreakdown.shopEffectsApplied);

        return { score: totalWeightedScore, timingScoreVal: timingScoreRaw, performanceScoreVal: performanceScoreRaw, creativityScoreVal: creativityScoreRaw, detailedBreakdown };
    }

    showScoreModal(score, stars, earnedInspirationPoints, comment, detailedBreakdown) {
        if (!this.ui.scoreModal) return;

        const buttonsToRecreate = ['retry-btn', 'next-level-btn', 'watch-ad-double-reward'];
        buttonsToRecreate.forEach(btnId => {
            const oldBtn = this.ui.scoreModal.querySelector(`#${btnId}`);
            if (oldBtn) {
                const newBtn = oldBtn.cloneNode(true);
                oldBtn.parentNode.replaceChild(newBtn, oldBtn);
                if (btnId === 'retry-btn') this.ui.retryBtn = newBtn;
                if (btnId === 'next-level-btn') this.ui.nextLevelBtn = newBtn;
            }
        });
        const scoreModalCloseBtn = this.ui.scoreModal.querySelector('.score-modal-close-btn');
        if (scoreModalCloseBtn) {
             const newCloseBtn = scoreModalCloseBtn.cloneNode(true);
             scoreModalCloseBtn.parentNode.replaceChild(newCloseBtn, scoreModalCloseBtn);
             newCloseBtn.addEventListener('click', () => this.app.menu.hideModal(this.ui.scoreModal));
        }

        if (this.ui.retryBtn) this.ui.retryBtn.addEventListener('click', () => this.retryLevel());
        if (this.ui.nextLevelBtn) this.ui.nextLevelBtn.addEventListener('click', () => this.goToNextLevel());

        if(this.ui.finalStarsDisplay) this.ui.finalStarsDisplay.innerHTML = this.app.levels.renderStars(stars);
        if(this.ui.finalScoreDisplay) this.ui.finalScoreDisplay.textContent = score;
        if(this.ui.scoreCommentDisplay) this.ui.scoreCommentDisplay.textContent = comment;
        if(this.ui.earnedPointsDisplay) {
             this.ui.earnedPointsDisplay.innerHTML = `+${earnedInspirationPoints} <span class="retro-coin-icon ml-1"></span> <span class="text-sm">灵感</span>`;
             this.ui.earnedPointsDisplay.dataset.basePoints = earnedInspirationPoints;
        }
        
        // Add detailed breakdown of shop effects to score modal if any
        const shopEffectsFeedbackEl = this.ui.scoreModal.querySelector('#shop-effects-feedback');
        if(shopEffectsFeedbackEl){
            if(detailedBreakdown.shopEffectsApplied && detailedBreakdown.shopEffectsApplied.length > 0) {
                shopEffectsFeedbackEl.innerHTML = `<strong>特殊效果加成:</strong><ul class="list-disc list-inside text-xs mt-1 text-purple-300">${detailedBreakdown.shopEffectsApplied.map(eff => `<li>${eff}</li>`).join('')}</ul>`;
                shopEffectsFeedbackEl.classList.remove('hidden');
            } else {
                shopEffectsFeedbackEl.innerHTML = '';
                shopEffectsFeedbackEl.classList.add('hidden');
            }
        }


        const nextLevelData = this.app.levels.getNextLevelData(this.currentLevelData.id);
        if (this.ui.nextLevelBtn) {
            if (nextLevelData) {
                this.ui.nextLevelBtn.classList.remove('hidden');
                this.ui.nextLevelBtn.disabled = false;
            } else {
                this.ui.nextLevelBtn.classList.add('hidden');
            }
        }
        this.app.menu.showModalDirectly(this.ui.scoreModal);
        this.app.playUISound('score_final');

        const watchAdBtn = this.ui.scoreModal.querySelector('#watch-ad-double-reward');
        if (watchAdBtn) {
            if (this.app.menu && typeof this.app.menu.showDoubleRewardAdOption === 'function') {
                this.app.menu.showDoubleRewardAdOption(earnedInspirationPoints);
            } else {
                watchAdBtn.classList.add('hidden');
            }
        }

        if(this.ui.recordBtn) this.ui.recordBtn.disabled = true;
        if(this.ui.playbackBtn) this.ui.playbackBtn.disabled = true;
        if(this.ui.submitBtn) this.ui.submitBtn.disabled = true;
        if(this.ui.previewBtn) this.ui.previewBtn.disabled = true;
    }

    retryLevel() {
        this.app.playUISound('click');
        const hideCallback = () => {
            this.loadLevel(this.currentLevelData.id);
        };
        if(this.ui.scoreModal && this.ui.scoreModal.classList.contains('active')) {
            this.app.menu.hideModal(this.ui.scoreModal, hideCallback);
        } else {
            hideCallback();
        }
         console.log("Retrying level...");
    }
    goToNextLevel() {
        this.app.playUISound('click');
        const hideCallback = () => {
            const nextLevel = this.app.levels.getNextLevelData(this.currentLevelData.id);
            if (nextLevel) {
                this.app.showScene('game-scene', { levelId: nextLevel.id, showLoading: true, loadingDuration: 800 });
            } else {
                this.app.showScene('level-select', { showLoading: true, loadingDuration: 800 });
            }
        };
         if(this.ui.scoreModal && this.ui.scoreModal.classList.contains('active')) {
            this.app.menu.hideModal(this.ui.scoreModal, hideCallback);
        } else {
             hideCallback();
        }
         console.log("Going to next level...");
    }

    leaveLevelCleanup() {
        console.log("🧹 清理关卡资源...");
        this.clearVideoTimelineUpdate();
        this.stopAudioVisualizationLoop();
        this.app.audio.stopPlayback();
        if (this.isRecording) {
            this.app.audio.stopRecording().catch(e => console.warn("Error stopping recording on leave:", e));
            this.isRecording = false;
        }
        this.recordedAudio = null; this.selectedItems = []; this.currentLevelData = null;
        this.recordingStartTimestamp = 0;
        this.levelObjectiveShown = false;
        this.playedCueAlerts.clear();

        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.onloadedmetadata = null; this.videoElement.onerror = null; this.videoElement.onended = null; this.videoElement.oncanplay = null;
            this.videoElement.removeAttribute('src');
            this.videoElement.load();
        }
        if(this.ui.timelineProgress) this.ui.timelineProgress.style.width = '0%';
        if(this.ui.currentTimeDisplay) this.ui.currentTimeDisplay.textContent = '0:00';
        if(this.ui.totalTimeDisplay) this.ui.totalTimeDisplay.textContent = '0:00';
        if(this.ui.levelTitle) this.ui.levelTitle.textContent = '加载中...';
        this.clearAudioVisualization();
        if(this.ui.timelineCuePoints) this.ui.timelineCuePoints.innerHTML = '';

        if(this.ui.recordBtn) { this.ui.recordBtn.classList.remove('recording'); this.ui.recordBtn.disabled = true; this.ui.recordText.textContent = '开始狂嚎!'; this.ui.recordBtn.title="视频加载后可录音"; }
        if(this.ui.playbackBtn) { this.ui.playbackBtn.disabled = true; this.ui.playbackBtn.title="录音后可试听";}
        if(this.ui.submitBtn) { this.ui.submitBtn.disabled = true; this.ui.submitBtn.title="录音并选择物品后可提交";}
        if(this.ui.previewBtn) { this.ui.previewBtn.disabled = true; this.ui.previewBtn.title="视频加载后可预览";}
        if(this.ui.itemSlotsContainer) this.ui.itemSlotsContainer.innerHTML = '';
        this.updateSelectedItemDisplay();

        if(this.ui.timingScoreDisplay) this.ui.timingScoreDisplay.textContent = '--';
        if(this.ui.performanceScoreDisplay) this.ui.performanceScoreDisplay.textContent = '--';
        if(this.ui.creativityScoreDisplay) this.ui.creativityScoreDisplay.textContent = '--';

        if (this.ui.scoreModal && this.ui.scoreModal.classList.contains('active')) {
             this.app.menu.hideModal(this.ui.scoreModal);
        }
        if (this.ui.objectiveModal && this.ui.objectiveModal.classList.contains('active')) {
            this.app.menu.hideModal(this.ui.objectiveModal);
        }
        this.showVideoPlaceholder('loading', '准备新关卡...');
    }
    formatTime(seconds) {
        const s = Math.max(0, seconds || 0);
        const mins = Math.floor(s / 60);
        const secs = Math.floor(s % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}
