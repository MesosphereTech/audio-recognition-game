// Audio Matching Game Logic
class AudioMatchingGame {
    constructor(app) {
        this.app = app;
        this.video = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.duration = 0;
        this.playbackSpeed = 1.0;
        
        // Game state
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.tracks = [];
        this.activeTracks = [];
        this.matchedTracks = 0;
        this.totalTracks = 0;
        
        // Timeline
        this.timelineWidth = 0;
        this.pixelsPerSecond = 100; // How many pixels = 1 second
        
        // Drag and drop
        this.draggedItem = null;
        this.isDragging = false;
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.loadItemLibrary();
        console.log('🎮 音频匹配游戏已初始化');
    }

    setupElements() {
        // Video elements
        this.video = document.getElementById('matching-video');
        this.videoOverlay = document.getElementById('matching-video-overlay');
        this.playBtn = document.getElementById('matching-play-btn');
        this.resetBtn = document.getElementById('matching-reset-btn');
        this.pauseBtn = document.getElementById('matching-pause-btn');
        
        // Timeline elements
        this.tracksContainer = document.getElementById('audio-tracks-container');
        this.timelineCursor = document.getElementById('timeline-cursor');
        this.currentTimeDisplay = document.getElementById('matching-current-time');
        this.totalTimeDisplay = document.getElementById('matching-total-time');
        
        // Controls
        this.speedSlider = document.getElementById('playback-speed');
        this.speedDisplay = document.getElementById('speed-display');
        this.scoreDisplay = document.getElementById('matching-score-display');
        this.comboCounter = document.getElementById('combo-counter');
        
        // Item library
        this.itemLibrary = document.getElementById('item-library');
        
        // Navigation
        this.backBtn = document.getElementById('matching-back-to-levels');
    }

    setupEventListeners() {
        // Video controls
        this.playBtn.addEventListener('click', () => this.togglePlayback());
        this.resetBtn.addEventListener('click', () => this.resetGame());
        this.pauseBtn.addEventListener('click', () => this.pauseGame());
        this.videoOverlay.addEventListener('click', () => this.togglePlayback());
        
        // Speed control
        this.speedSlider.addEventListener('input', (e) => {
            this.playbackSpeed = parseFloat(e.target.value);
            this.speedDisplay.textContent = this.playbackSpeed.toFixed(1) + 'x';
            if (this.video) {
                this.video.playbackRate = this.playbackSpeed;
            }
        });
        
        // Video events
        if (this.video) {
            this.video.addEventListener('loadedmetadata', () => {
                this.duration = this.video.duration;
                this.totalTimeDisplay.textContent = this.formatTime(this.duration);
                this.calculateTimelineWidth();
            });
            
            this.video.addEventListener('timeupdate', () => {
                this.currentTime = this.video.currentTime;
                this.updateTimeline();
                this.updateTracks();
            });
            
            this.video.addEventListener('ended', () => {
                this.onGameEnd();
            });
        }
        
        // Navigation
        this.backBtn.addEventListener('click', () => {
            this.app.switchToScene('level-select');
        });
    }

    setupDragAndDrop() {
        // Enable drag and drop for the tracks container
        this.tracksContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.handleDragOver(e);
        });
        
        this.tracksContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleDrop(e);
        });
        
        this.tracksContainer.addEventListener('dragleave', (e) => {
            this.handleDragLeave(e);
        });
    }

    loadItemLibrary() {
        const items = Object.keys(window.GAME_DATA.items);
        this.itemLibrary.innerHTML = '';
        
        items.forEach(itemId => {
            const item = window.GAME_DATA.items[itemId];
            const itemElement = this.createDraggableItem(itemId, item);
            this.itemLibrary.appendChild(itemElement);
        });
    }

    createDraggableItem(itemId, item) {
        const element = document.createElement('div');
        element.className = 'draggable-item';
        element.draggable = true;
        element.dataset.itemId = itemId;
        
        element.innerHTML = `
            <div class="item-icon">${item.icon || '🔊'}</div>
            <div class="item-name">${item.name}</div>
        `;
        
        // Drag events
        element.addEventListener('dragstart', (e) => {
            this.draggedItem = itemId;
            element.classList.add('dragging');
            e.dataTransfer.setData('text/plain', itemId);
        });
        
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            this.draggedItem = null;
        });
        
        return element;
    }

    loadLevel(levelData) {
        console.log('🎬 加载音频匹配关卡:', levelData);
        
        // Reset game state
        this.resetGameState();
        
        // Load video
        if (levelData.videoUrl) {
            this.video.src = levelData.videoUrl;
            this.videoOverlay.style.display = 'none';
        }
        
        // Load audio tracks data
        this.tracks = levelData.audioTracks || this.generateSampleTracks();
        this.totalTracks = this.tracks.length;
        
        // Update title
        document.getElementById('matching-level-title').textContent = levelData.title || '音频匹配模式';
    }

    generateSampleTracks() {
        // Generate sample tracks for demonstration
        return [
            { id: 1, startTime: 2, duration: 3, soundType: 'metal', label: '金属碰撞声' },
            { id: 2, startTime: 6, duration: 2, soundType: 'water', label: '水流声' },
            { id: 3, startTime: 10, duration: 4, soundType: 'wood', label: '木头敲击' },
            { id: 4, startTime: 15, duration: 2, soundType: 'paper', label: '纸张翻动' },
            { id: 5, startTime: 18, duration: 3, soundType: 'fabric', label: '布料摩擦' }
        ];
    }

    calculateTimelineWidth() {
        if (this.duration > 0) {
            this.timelineWidth = this.tracksContainer.clientWidth;
            this.pixelsPerSecond = this.timelineWidth / this.duration;
        }
    }

    updateTimeline() {
        // Update time display
        this.currentTimeDisplay.textContent = this.formatTime(this.currentTime);
        
        // Update cursor position
        if (this.duration > 0) {
            const progress = this.currentTime / this.duration;
            const cursorPosition = progress * this.timelineWidth;
            this.timelineCursor.style.left = cursorPosition + 'px';
        }
    }

    updateTracks() {
        // Check which tracks should be visible
        this.tracks.forEach(track => {
            const trackElement = document.getElementById(`track-${track.id}`);
            const shouldBeVisible = this.currentTime >= track.startTime - 3 && 
                                  this.currentTime <= track.startTime + track.duration + 1;
            
            if (shouldBeVisible && !trackElement) {
                this.createTrackElement(track);
            } else if (!shouldBeVisible && trackElement) {
                this.removeTrackElement(track.id);
            } else if (trackElement) {
                this.updateTrackPosition(track, trackElement);
            }
        });
    }

    createTrackElement(track) {
        const element = document.createElement('div');
        element.className = 'audio-track';
        element.id = `track-${track.id}`;
        element.dataset.trackId = track.id;
        element.dataset.soundType = track.soundType;
        
        // Calculate vertical position (track lanes)
        const trackIndex = this.tracks.indexOf(track);
        const trackHeight = 50; // Including margin
        const topPosition = 20 + (trackIndex % 8) * trackHeight;
        
        element.style.top = topPosition + 'px';
        element.style.width = (track.duration * this.pixelsPerSecond) + 'px';
        
        element.innerHTML = `
            <div class="track-label">${track.label}</div>
            <div class="track-drop-zone" data-track-id="${track.id}"></div>
        `;
        
        this.tracksContainer.appendChild(element);
        this.activeTracks.push(track.id);
        
        // Start moving animation
        this.animateTrack(element, track);
    }

    animateTrack(element, track) {
        const startPosition = this.timelineWidth;
        const endPosition = -element.offsetWidth;
        const duration = (track.startTime + track.duration - this.currentTime + 3) * 1000 / this.playbackSpeed;
        
        element.style.left = startPosition + 'px';
        
        // Animate track movement
        const animation = element.animate([
            { left: startPosition + 'px' },
            { left: endPosition + 'px' }
        ], {
            duration: duration,
            easing: 'linear',
            fill: 'forwards'
        });
        
        // Handle track missed (reached left edge without match)
        animation.addEventListener('finish', () => {
            if (!element.classList.contains('matched')) {
                this.handleTrackMissed(track.id);
            }
        });
    }

    updateTrackPosition(track, element) {
        // Update position based on current time and playback speed
        const elapsed = this.currentTime - (track.startTime - 3);
        const position = this.timelineWidth - (elapsed * this.pixelsPerSecond);
        element.style.left = position + 'px';
    }

    removeTrackElement(trackId) {
        const element = document.getElementById(`track-${trackId}`);
        if (element) {
            element.remove();
        }
        this.activeTracks = this.activeTracks.filter(id => id !== trackId);
    }

    handleDragOver(e) {
        const dropZone = e.target.closest('.track-drop-zone');
        if (dropZone && this.draggedItem) {
            dropZone.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        const dropZone = e.target.closest('.track-drop-zone');
        if (dropZone) {
            dropZone.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        const dropZone = e.target.closest('.track-drop-zone');
        if (!dropZone || !this.draggedItem) return;
        
        dropZone.classList.remove('drag-over');
        
        const trackId = parseInt(dropZone.dataset.trackId);
        const track = this.tracks.find(t => t.id === trackId);
        
        if (track) {
            this.checkMatch(track, this.draggedItem);
        }
    }

    checkMatch(track, itemId) {
        const isCorrect = track.soundType === itemId;
        const trackElement = document.getElementById(`track-${track.id}`);
        
        if (isCorrect) {
            this.handleCorrectMatch(track, trackElement);
        } else {
            this.handleIncorrectMatch(track, trackElement);
        }
    }

    handleCorrectMatch(track, element) {
        element.classList.add('matched', 'track-success');
        this.matchedTracks++;
        this.combo++;
        
        // Calculate score based on timing
        const timingBonus = this.calculateTimingBonus(track);
        const comboBonus = Math.floor(this.combo / 3);
        const baseScore = 100;
        const finalScore = baseScore + timingBonus + comboBonus;
        
        this.score += finalScore;
        this.updateScore();
        this.showScorePopup(finalScore, element);
        
        // Combo effect
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }
        this.updateCombo();
        
        // Audio feedback
        if (this.app.audioManager) {
            this.app.audioManager.playSFX('success');
        }
        
        console.log(`✅ 正确匹配! 音轨: ${track.label}, 得分: ${finalScore}`);
    }

    handleIncorrectMatch(track, element) {
        element.classList.add('track-miss');
        this.combo = 0; // Reset combo
        this.updateCombo();
        
        // Audio feedback
        if (this.app.audioManager) {
            this.app.audioManager.playSFX('error');
        }
        
        console.log(`❌ 匹配错误! 音轨: ${track.label}`);
    }

    handleTrackMissed(trackId) {
        const track = this.tracks.find(t => t.id === trackId);
        if (track) {
            this.combo = 0; // Reset combo
            this.updateCombo();
            console.log(`⏰ 错过音轨: ${track.label}`);
        }
    }

    calculateTimingBonus(track) {
        // Calculate bonus based on how close the match was to the optimal timing
        const optimalTime = track.startTime + track.duration / 2;
        const timeDifference = Math.abs(this.currentTime - optimalTime);
        const maxBonus = 50;
        const bonus = Math.max(0, maxBonus - (timeDifference * 10));
        return Math.floor(bonus);
    }

    showScorePopup(score, element) {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = `+${score}`;
        popup.style.left = element.offsetLeft + element.offsetWidth / 2 + 'px';
        popup.style.top = element.offsetTop + 'px';
        
        this.tracksContainer.appendChild(popup);
        
        setTimeout(() => {
            popup.remove();
        }, 1000);
    }

    updateScore() {
        this.scoreDisplay.textContent = `得分: ${this.score}`;
    }

    updateCombo() {
        this.comboCounter.textContent = this.combo;
        if (this.combo > 2) {
            this.comboCounter.classList.add('combo-boost');
            setTimeout(() => {
                this.comboCounter.classList.remove('combo-boost');
            }, 500);
        }
    }

    togglePlayback() {
        if (!this.video) return;
        
        if (this.isPlaying) {
            this.video.pause();
            this.playBtn.innerHTML = '<span class="retro-button-text">▶ 播放</span>';
            this.isPlaying = false;
        } else {
            this.video.play();
            this.playBtn.innerHTML = '<span class="retro-button-text">⏸ 暂停</span>';
            this.isPlaying = true;
            this.videoOverlay.style.display = 'none';
        }
    }

    pauseGame() {
        if (this.isPlaying) {
            this.isPaused = !this.isPaused;
            if (this.isPaused) {
                this.video.pause();
                this.pauseBtn.innerHTML = '<span class="retro-button-text">继续</span>';
            } else {
                this.video.play();
                this.pauseBtn.innerHTML = '<span class="retro-button-text">暂停</span>';
            }
        }
    }

    resetGame() {
        this.resetGameState();
        if (this.video) {
            this.video.currentTime = 0;
            this.video.pause();
        }
        this.clearTracks();
        this.playBtn.innerHTML = '<span class="retro-button-text">▶ 播放</span>';
        this.isPlaying = false;
    }

    resetGameState() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.matchedTracks = 0;
        this.activeTracks = [];
        this.updateScore();
        this.updateCombo();
    }

    clearTracks() {
        this.tracksContainer.querySelectorAll('.audio-track').forEach(track => {
            track.remove();
        });
        this.activeTracks = [];
    }

    onGameEnd() {
        console.log('🏁 游戏结束');
        
        // Calculate final score and statistics
        const accuracy = this.totalTracks > 0 ? (this.matchedTracks / this.totalTracks) * 100 : 0;
        const results = {
            score: this.score,
            accuracy: accuracy.toFixed(1),
            maxCombo: this.maxCombo,
            matchedTracks: this.matchedTracks,
            totalTracks: this.totalTracks
        };
        
        // Show results
        this.showGameResults(results);
    }

    showGameResults(results) {
        const message = `
            游戏完成！
            
            最终得分: ${results.score}
            匹配准确率: ${results.accuracy}%
            最高连击: ${results.maxCombo}
            成功匹配: ${results.matchedTracks}/${results.totalTracks}
        `;
        
        if (this.app) {
            this.app.showNotification(message, 'success');
        }
        
        // Could show a detailed results modal here
        console.log('🎉 游戏结果:', results);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// Export for use in main app
window.AudioMatchingGame = AudioMatchingGame; 