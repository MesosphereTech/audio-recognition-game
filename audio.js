// Audio recording and playback management
class AudioManager {
    constructor(app) {
        this.app = app; // Store app instance for notifications
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null; // MediaStreamSourceNode from audioStream
        this.scriptProcessor = null; // For legacy, not actively used if AnalyserNode is primary
        this.volumeData = []; // Stores { time: contextTime, volume: 0-100 }
        this.waveformPoints = []; // Stores { time: contextTime, value: average absolute deviation or similar }

        this.activeSFX = []; // Array of playing Audio objects for SFX
        this.backgroundAudio = null; // Single Audio object for BGM
        this.masterVolume = 0.8; // 0.0 to 1.0
        this.sfxVolume = 0.7;    // 0.0 to 1.0
        this.bgmVolume = 0.6;    // 0.0 to 1.0

        this.recordingStartAudioContextTime = 0; // To help sync analysis data timestamps

        this.gainNode = null;

        this.init();
    }

    init() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const message = '浏览器不支持音频录制功能 (getUserMedia API缺失)。';
            console.warn(message);
            if (this.app) this.app.showNotification(message, 'error');
            return; // No further audio initialization if core feature missing
        }
         try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            console.log('🎵 音频系统已初始化');
            if (this.audioContext.state === 'suspended') {
                 this.addContextResumeListeners();
            } else {
                 console.log('Audio Context is running.');
            }
         } catch (e) {
             const message = '无法创建音频上下文，音频功能将受限。';
             console.error(message, e);
             if (this.app) this.app.showNotification(message, 'error');
         }

        console.log('🎵 音频管理器已初始化');
    }

    addContextResumeListeners() {
        const resumeContext = () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('Audio Context resumed successfully by user gesture.');
                }).catch(e => console.error('Failed to resume Audio Context on user gesture', e))
                .finally(() => { // Always remove listeners after first attempt
                    document.body.removeEventListener('click', resumeContext, true);
                    document.body.removeEventListener('touchstart', resumeContext, true);
                });
            } else { // Context is not suspended or already resumed, clean up listeners
                document.body.removeEventListener('click', resumeContext, true);
                document.body.removeEventListener('touchstart', resumeContext, true);
            }
        };
        // Listen on body, capture phase, once:
        document.body.addEventListener('click', resumeContext, { capture: true, once: true });
        document.body.addEventListener('touchstart', resumeContext, { capture: true, once: true });
        console.log('Audio Context is suspended, adding user gesture listeners to resume.');
        if (this.app) this.app.showNotification('点击屏幕任意位置以激活音频。', 'info');
    }

    async ensureAudioContextRunning() {
         if (!this.audioContext) {
             console.error('Audio Context not initialized.');
             throw new Error('音频系统尚未初始化。');
         }
         if (this.audioContext.state === 'suspended') {
             console.log('Attempting to resume suspended Audio Context programmatically (may require user gesture)...');
             try {
                 await this.audioContext.resume();
                 console.log('Audio Context resumed via direct call.');
             } catch (e) {
                 console.error('Failed to resume Audio Context directly, user gesture likely required:', e);
                 this.addContextResumeListeners(); // Re-add listeners if direct resume fails
                 throw new Error('音频系统需要用户交互 (如点击屏幕) 才能启动。');
             }
         }
         if (this.audioContext.state !== 'running') {
             const message = `音频上下文状态异常: ${this.audioContext.state}。可能需要用户交互。`;
             console.error(message);
             throw new Error(message);
         }
    }

    async requestMicrophonePermission() {
        if (!this.audioContext) {
            throw new Error('音频上下文不可用，无法请求麦克风。');
        }
        try {
            await this.ensureAudioContextRunning(); // Ensure context is running before asking for mic

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: this.audioContext.sampleRate // Match context sample rate if possible
                }
            });
            console.log('✅ 麦克风权限已获取');
            this.audioStream = stream;
            return stream;
        } catch (error) {
            console.error('❌ 麦克风权限或设备访问被拒绝:', error);
            let userMessage = '无法访问麦克风。请检查浏览器设置。';
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                 userMessage = '麦克风权限被拒绝，请在浏览器设置中允许访问。';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                 userMessage = '未找到麦克风设备，请检查设备连接。';
            } else if (error.name === 'NotReadableError' || error.name === 'OverconstrainedError') {
                 userMessage = '麦克风无法使用，可能被其他应用占用或配置有误。';
            } else {
                 userMessage = `麦克风访问错误: ${error.message || error.name}`;
            }
            if (this.app) this.app.showNotification(userMessage, 'error');
            throw new Error(userMessage);
        }
    }

    async startRecording() {
        if (this.isRecording) {
            console.warn('录音已在进行中，忽略新的开始请求。');
            return Promise.resolve();
        }

        try {
            if (!this.audioStream || this.audioStream.getAudioTracks().every(track => track.readyState === 'ended')) {
                await this.requestMicrophonePermission(); // This also ensures context is running
            } else {
                await this.ensureAudioContextRunning(); // Ensure context is running for existing stream
            }

            // Check MediaRecorder support with preferred MIME types
            const mimeType = this.getSupportedMimeType();
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                console.warn(`MIME type ${mimeType} not supported. Trying default.`);
                 // Fallback or error
            }

            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: mimeType,
                audioBitsPerSecond: 128000 // Standard quality
            });

            this.audioChunks = [];
            this.volumeData = [];
            this.waveformPoints = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) this.audioChunks.push(event.data);
            };
            this.mediaRecorder.onstop = () => console.log('📼 MediaRecorder 已停止');
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder 错误:', event.error);
                if(this.app) this.app.showNotification(`录音设备发生错误: ${event.error.name || '未知错误'}`, 'error');
                this.cleanupRecorderAndStream(false); // Don't stop tracks, might be recoverable
            };

            await this.setupAudioAnalysis(); // Setup analyser for the current stream
            this.recordingStartAudioContextTime = this.audioContext.currentTime;
            this.startAnalysisLoop();

            this.mediaRecorder.start(100); // Collect data in 100ms chunks
            this.isRecording = true;
            console.log('🎤 开始录音');
            return Promise.resolve();

        } catch (error) {
            console.error('启动录音失败:', error);
            this.cleanupRecorderAndStream(false);
            // Error message already shown by requestMicrophonePermission or ensureAudioContextRunning
            throw error; // Re-throw to be handled by GameManager
        }
    }

    getSupportedMimeType() {
        const mimeTypes = [
            'audio/webm;codecs=opus', 'audio/ogg;codecs=opus',
            'audio/mp4', // Often supported, good quality
            'audio/webm', 'audio/ogg', 'audio/wav' // WAV can be large
        ];
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                 console.log(`使用MimeType: ${mimeType}`);
                return mimeType;
            }
        }
        const defaultType = 'audio/webm'; // Fallback
        console.warn(`未找到推荐的音频格式，使用默认: ${defaultType}`);
        return defaultType;
    }

    async setupAudioAnalysis() {
        if (!this.audioStream || !this.audioContext || this.audioContext.state !== 'running') {
             console.warn('无法设置音频分析器: Stream 或 Context 不可用/未运行');
             if (this.audioContext && this.audioContext.state === 'suspended') {
                  try { await this.audioContext.resume(); }
                  catch (e) { console.warn("Resuming context for analysis failed (non-blocking)", e); }
             }
             if (!this.audioContext || this.audioContext.state !== 'running') {
                 const message = '音频上下文未运行，无法进行分析。';
                 console.error(message);
                 if (this.app) this.app.showNotification(message, 'error');
                 return;
             }
        }

        try {
            if (this.microphone) { // Disconnect previous source if any
                try { this.microphone.disconnect(); } catch (e) { /* ignore */ }
            }
            this.microphone = this.audioContext.createMediaStreamSource(this.audioStream);

            if (!this.analyser || this.analyser.context !== this.audioContext) { // Recreate if context changed
                 this.analyser = this.audioContext.createAnalyser();
                 this.analyser.fftSize = 2048; // Standard FFT size for detailed analysis
                 this.analyser.smoothingTimeConstant = 0.8; // Standard smoothing
            }

            // Connect: Mic Source -> Analyser.
            // We do NOT connect analyser to destination here to avoid mic passthrough during recording,
            // unless specifically desired for monitoring (then: this.analyser.connect(this.audioContext.destination);)
            this.microphone.connect(this.analyser);
            console.log('🎛️ 音频分析器和节点已设置 (Mic -> Analyser)');
        } catch (error) {
            console.error('设置音频分析器失败:', error);
            if(this.app) this.app.showNotification('音频分析器设置失败。', 'error');
            this.analyser = null;
            if (this.microphone) {
                try { this.microphone.disconnect(); } catch(e) {}
            }
            this.microphone = null;
        }
    }

    analysisFrameId = null;

    startAnalysisLoop() {
         if (!this.analyser || this.analysisFrameId) return;

         const dataArrayFreq = new Uint8Array(this.analyser.frequencyBinCount);
         const dataArrayTime = new Uint8Array(this.analyser.fftSize);

         const loop = () => {
             if (!this.isRecording || !this.analyser) {
                 this.stopAnalysisLoop(); return;
             }

             this.analyser.getByteFrequencyData(dataArrayFreq);
             this.analyser.getByteTimeDomainData(dataArrayTime);

             let sum = 0;
             for (let i = 0; i < dataArrayFreq.length; i++) sum += dataArrayFreq[i];
             const averageVolumeRaw = sum / dataArrayFreq.length;
             // Scale volume for UI (0-100). Adjust scaling factor as needed.
             const volume = Math.min(100, Math.max(0, Math.round((averageVolumeRaw / 255) * 200 - 20))); // Adjusted for sensitivity


             const currentRelativeTime = this.audioContext.currentTime - this.recordingStartAudioContextTime;
             this.volumeData.push({ time: currentRelativeTime, volume: volume });

             // For waveform, store average absolute deviation of time domain data
             // This is a simpler representation than storing the full array repeatedly.
             let sumAbsDev = 0;
             for (let i = 0; i < dataArrayTime.length; i++) {
                 sumAbsDev += Math.abs(dataArrayTime[i] - 128); // Deviation from midpoint (128 for Uint8)
             }
             const avgAbsDev = sumAbsDev / dataArrayTime.length;
             this.waveformPoints.push({ time: currentRelativeTime, value: avgAbsDev });


             // Dispatch event for external visualization (e.g., game.js)
             window.dispatchEvent(new CustomEvent('audioanalysisdata', {
                 detail: {
                     volume: volume,
                     frequencyData: new Uint8Array(dataArrayFreq), // Send a copy
                     timeDomainData: new Uint8Array(dataArrayTime)  // Send a copy
                 }
             }));
             this.analysisFrameId = requestAnimationFrame(loop);
         };
         this.analysisFrameId = requestAnimationFrame(loop);
    }

    stopAnalysisLoop() {
         if (this.analysisFrameId) {
             cancelAnimationFrame(this.analysisFrameId);
             this.analysisFrameId = null;
         }
    }

    async stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            console.warn('没有正在进行的录音。');
            return null;
        }

        this.isRecording = false; // Set flag immediately
        this.stopAnalysisLoop();

        // Disconnect microphone from analyser to stop processing live input.
        // Analyser itself can be reused.
        if (this.microphone && this.analyser) {
             try { this.microphone.disconnect(this.analyser); console.log("Microphone disconnected from analyser.");}
             catch(e) { console.warn("Error disconnecting microphone from analyser:", e); }
        }
        // If analyser was connected to destination, disconnect it too.
        // if (this.analyser && this.audioContext.destination) {
        //      try { this.analyser.disconnect(this.audioContext.destination); } catch(e) {}
        // }


        return new Promise((resolve, reject) => {
            const finalizeRecording = async () => {
                if(this.mediaRecorder) {
                    this.mediaRecorder.removeEventListener('stop', finalizeRecording);
                    this.mediaRecorder.removeEventListener('error', handleRecordingError);
                }

                 try {
                    const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || this.getSupportedMimeType() });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    let audioBuffer = null;
                    let duration = this.calculateRecordingDuration(); // Fallback based on analysis data

                    if (audioBlob.size === 0) {
                        console.warn("录音数据为空 (0 bytes)。");
                        if(this.app) this.app.showNotification('录音数据为空，请重试。', 'error');
                        // Resolve with null or minimal data to indicate failure to record properly
                        resolve({ blob: audioBlob, url: audioUrl, duration: 0, size: 0, audioBuffer: null, volumeData: [], waveformPoints: [] });
                        this.cleanupRecorderAndStream(true); // Full cleanup
                        return;
                    }

                    try {
                        audioBuffer = await this.createAudioBufferFromBlob(audioBlob);
                        duration = audioBuffer.duration; // More accurate duration from AudioBuffer
                        console.log('AudioBuffer created, duration:', duration.toFixed(2) + 's');
                    } catch (bufferError) {
                        console.warn('无法创建AudioBuffer进行精确分析:', bufferError);
                        if(this.app) this.app.showNotification('录音文件分析可能不完整。', 'error');
                        // Proceed with duration from volumeData as fallback
                    }

                    const audioData = {
                        blob: audioBlob, url: audioUrl, duration: duration,
                        size: audioBlob.size, audioBuffer: audioBuffer,
                        volumeData: [...this.volumeData], // Copy data
                        waveformPoints: [...this.waveformPoints] // Copy data
                    };
                    console.log('📋 录音数据:', audioData);
                    this.cleanupRecorderAndStream(true); // Full cleanup after successful processing
                    resolve(audioData);

                } catch (error) {
                    console.error('处理录音数据失败:', error);
                    this.cleanupRecorderAndStream(true);
                    if(this.app) this.app.showNotification('处理录音数据失败。', 'error');
                    reject(error);
                }
            };

            const handleRecordingError = (event) => {
                if(this.mediaRecorder) {
                    this.mediaRecorder.removeEventListener('stop', finalizeRecording);
                    this.mediaRecorder.removeEventListener('error', handleRecordingError);
                }
                 console.error('录音错误 (onstop/onerror):', event.error || event);
                 this.cleanupRecorderAndStream(true);
                 if(this.app) this.app.showNotification(`录音时发生错误: ${event.error?.name || '未知错误'}`, 'error');
                 reject(event.error || new Error("Unknown recording error"));
            };

            if(this.mediaRecorder) {
                this.mediaRecorder.addEventListener('stop', finalizeRecording);
                this.mediaRecorder.addEventListener('error', handleRecordingError);

                if (this.mediaRecorder.state === 'recording') {
                     this.mediaRecorder.stop(); // This will trigger 'ondataavailable' then 'onstop'
                } else if (this.mediaRecorder.state === 'inactive' && this.audioChunks.length > 0) {
                     // If already inactive but chunks exist (e.g., error occurred but data was captured, or stop called externally)
                     finalizeRecording(); // Try to process existing data
                } else {
                    const errorMsg = `MediaRecorder state is '${this.mediaRecorder.state}'. No audio data captured or stop already processed.`;
                    console.error(errorMsg);
                    handleRecordingError({error: new Error(errorMsg)});
                }
            } else { // No mediaRecorder instance, critical failure.
                 handleRecordingError({error: new Error("MediaRecorder instance was not available at stop.")});
            }
        });
    }

    async createAudioBufferFromBlob(audioBlob) {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            throw new Error('AudioContext is closed, cannot create AudioBuffer.');
        }
        await this.ensureAudioContextRunning();
        const arrayBuffer = await audioBlob.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
            throw new Error('ArrayBuffer from audioBlob is empty, cannot decode.');
        }
        try {
            return await this.audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error("decodeAudioData failed:", e, "ArrayBuffer length:", arrayBuffer.byteLength);
            throw e; // Re-throw the original error
        }
    }

    calculateRecordingDuration() { // Fallback if AudioBuffer fails
        if (this.volumeData.length > 0) {
            // Use the timestamp of the last recorded volume data point
            return this.volumeData[this.volumeData.length - 1].time;
        }
        // Rough estimate based on chunk interval (less reliable)
        return (this.audioChunks.length * 100) / 1000;
    }

    cleanupRecorderAndStream(stopStreamTracks = true) {
        if (stopStreamTracks && this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
            console.log('Audio stream tracks stopped and stream cleared.');
        }
        // Microphone node (MediaStreamSource) is disconnected in stopRecording or setupAudioAnalysis.
        // Analyser node can be reused.

        this.mediaRecorder = null;
        this.audioChunks = [];
        // volumeData and waveformPoints are copied with recordedAudio, they will be reset on next recording.
        console.log(`🧹 音频录制资源清理 (Recorder/Chunks). Stream tracks ${stopStreamTracks ? 'stopped.' : 'kept active.'}`);
    }

    async playRecording(audioData, videoElement = null) {
        if (!audioData || !audioData.url) {
            const msg = '无效的音频数据或URL，无法播放。';
            console.error(msg);
            if (this.app) this.app.showNotification(msg, 'error');
            throw new Error(msg);
        }

        await this.ensureAudioContextRunning();

        const audio = new Audio(audioData.url);
        audio.volume = this.masterVolume * this.sfxVolume;
        this.activeSFX.push(audio);

        return new Promise((resolve, reject) => {
            let videoPlayPromise = Promise.resolve();
            // Use 'loadeddata' for audio as 'canplaythrough' can be slow or not fire reliably
            let audioReadyPromise = new Promise(res => audio.addEventListener('loadeddata', res, { once: true }));
            let videoReadyPromise = Promise.resolve();

            if (videoElement) {
                videoReadyPromise = new Promise(res => {
                    // HTMLMediaElement.HAVE_FUTURE_DATA is 3, HAVE_ENOUGH_DATA is 4
                    if (videoElement.readyState >= 3) res(); 
                    else videoElement.addEventListener('loadeddata', res, { once: true });
                });
            }

            const onEnd = (source) => {
                console.log(`🔇 ${source} 播放结束`);
                audio.pause();
                if (videoElement) videoElement.pause();
                cleanup();
                resolve({audio, video: videoElement});
            };

            const onError = (source, errorEvent) => {
                console.error(`播放错误 (${source}):`, errorEvent.target?.error || errorEvent);
                audio.pause();
                if (videoElement) videoElement.pause();
                cleanup();
                if (this.app) this.app.showNotification(`播放 ${source} 失败。`, 'error');
                reject(errorEvent.target?.error || new Error(`Playback error in ${source}`));
            };

            const cleanup = () => {
                this.activeSFX = this.activeSFX.filter(a => a !== audio);
                // URL.revokeObjectURL(audioData.url); // IMPORTANT: Clean up blob URL - DO THIS CAREFULLY, ONLY IF BLOB IS NOT REUSED
                // If audioData.url is a blob URL and the blob is not needed elsewhere, revoke it.
                // For now, assume it might be reused (e.g. retry playback) so don't revoke immediately.
                // Consider revoking when the audioData object itself is discarded.

                audio.removeEventListener('ended', audioEndHandler);
                audio.removeEventListener('error', audioErrorHandler);
                if (videoElement) {
                    videoElement.removeEventListener('ended', videoEndHandler);
                    videoElement.removeEventListener('error', videoErrorHandler);
                }
            };

            const audioEndHandler = () => onEnd('音频');
            const videoEndHandler = () => onEnd('视频'); // Video ending might also signify end of synchronized playback
            const audioErrorHandler = (e) => onError('音频', e);
            const videoErrorHandler = (e) => onError('视频', e);

            audio.addEventListener('ended', audioEndHandler, { once: true });
            audio.addEventListener('error', audioErrorHandler, { once: true });
            if (videoElement) {
                videoElement.addEventListener('ended', videoEndHandler, { once: true });
                videoElement.addEventListener('error', videoErrorHandler, { once: true });
            }

            Promise.all([audioReadyPromise, videoReadyPromise]).then(() => {
                console.log(`🔊 准备播放录音 (时长: ${audioData.duration?.toFixed(1) || '未知' }s)`);
                if (videoElement) {
                    videoElement.currentTime = 0;
                    videoPlayPromise = videoElement.play().catch(e => { onError('视频播放启动', e); throw e; });
                }
                audio.currentTime = 0;
                const audioPlayPromiseVal = audio.play().catch(e => { onError('音频播放启动', e); throw e; });

                Promise.all([audioPlayPromiseVal, videoPlayPromise])
                    .then(() => console.log("音视频均已开始播放或已处理。"))
                    .catch(playError => console.error("Error during play initiation promises:", playError)); // Errors already handled by individual catches
            }).catch(loadError => {
                onError('媒体加载', loadError);
            });
        });
    }

    stopPlayback() {
        this.activeSFX.forEach(audio => {
            if (!audio.paused) {
                audio.pause();
                audio.currentTime = 0;
            }
            // URL revocation needs careful handling based on audioData lifecycle
        });
        this.activeSFX = [];
        console.log('🔇 所有活动音效播放已停止');
    }

    analyzeAudioCharacteristics(audioData, selectedItems = []) {
        console.log('🔬 开始音频分析...', audioData);
        if (!audioData || !audioData.audioBuffer) {
            console.warn('音频数据或AudioBuffer无效，无法进行详细分析。将使用模拟结果。');
            if (this.app) this.app.showNotification('音频分析可能不完整或基于模拟。', 'error');
            return this.simulateAudioAnalysis(selectedItems, audioData?.duration || 0, audioData?.volumeData || []);
        }

        const audioBuffer = audioData.audioBuffer;
        const duration = audioBuffer.duration;
        if (duration === 0 || !isFinite(duration)) { // Handle cases where duration might be zero or NaN
             console.warn('AudioBuffer duration is invalid. Using fallback or simulated results.');
             return this.simulateAudioAnalysis(selectedItems, audioData?.duration || 0.1, audioData?.volumeData || []);
        }
        const channelData = audioBuffer.getChannelData(0); // Analyze first channel

        // RMS for average volume
        let sumOfSquares = 0;
        for (let i = 0; i < channelData.length; i++) {
            sumOfSquares += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sumOfSquares / channelData.length);
        let volumeDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity; // dBFS, -Infinity for silence
        const minDb = -60, maxDb = 0; // Typical dBFS range for normalization
        let avgVolume = Math.max(0, Math.min(100, ((volumeDb - minDb) / (maxDb - minDb)) * 100));
        avgVolume = isNaN(avgVolume) ? 0 : Math.round(avgVolume); // Handle NaN if rms was 0

        // Peak Amplitude
        let peakAmplitude = 0;
        for (let i = 0; i < channelData.length; i++) {
            if (Math.abs(channelData[i]) > peakAmplitude) {
                peakAmplitude = Math.abs(channelData[i]);
            }
        }

        // Pitch Variation (Zero Crossing Rate - ZCR) - Heuristic
        let zeroCrossings = 0;
        for (let i = 1; i < channelData.length; i++) {
            if ((channelData[i-1] < 0 && channelData[i] >= 0) || (channelData[i-1] >= 0 && channelData[i] < 0)) {
                zeroCrossings++;
            }
        }
        const normalizedZCR = zeroCrossings / (channelData.length -1); // Normalize ZCR
        // Map ZCR to a 0-100 "pitch variation" score. This is highly heuristic.
        // Low ZCR ~ low variation (e.g., pure tone), High ZCR ~ high variation (e.g., noise).
        let pitchVariation = Math.min(100, normalizedZCR * 500); // Adjusted scaling factor based on typical ZCR values
        pitchVariation = isNaN(pitchVariation) ? 0 : Math.round(pitchVariation);

        // Clarity Score (heuristic based on average volume and peak amplitude)
        // Higher average volume and distinct peaks might imply better clarity for game purposes.
        let clarityScore = Math.min(100, avgVolume * 0.8 + peakAmplitude * 100 * 0.2); // Weighted average
        clarityScore = isNaN(clarityScore) ? 0 : Math.round(clarityScore);

        // Rhythm Detection (heuristic using pre-captured volumeData peaks from analysis loop)
        let rhythmDetected = false;
        if (audioData.volumeData && audioData.volumeData.length > 5 && duration > 0.5) {
            // Simple peak detection: count significant volume changes or peaks above a threshold
            const volumeThreshold = avgVolume * 0.6 + 20; // Dynamic threshold based on average volume
            const peaks = audioData.volumeData.filter(p => p.volume > volumeThreshold).length;
            const peakDensity = peaks / duration; // Peaks per second
            // Rhythmic sounds might have between 1.5 to 8 peaks/sec (e.g., tapping, simple beat)
            if (peakDensity > 1.5 && peakDensity < 8) {
                rhythmDetected = true;
            }
        }

        const estimatedType = this.guessAudioType(selectedItems, avgVolume, pitchVariation, normalizedZCR);

        const results = {
             duration: duration, volume: avgVolume, peakAmplitude: peakAmplitude,
             pitchVariation: pitchVariation, clarity: clarityScore, rhythmDetected: rhythmDetected,
             estimatedType: estimatedType,
             rawVolumeData: audioData.volumeData, // Pass through for scoring/visualization
             rawWaveformPoints: audioData.waveformPoints // Pass through for scoring/visualization
        };
        console.log('🔬 音频分析结果:', results);
        return results;
    }

    simulateAudioAnalysis(selectedItems, duration, volumeData = []) {
         console.warn('🔬 模拟音频分析 (AudioBuffer not available or analysis failed)');
         let avgVolume = 30 + Math.random() * 60; // More centered random range
         let pitchVar = 20 + Math.random() * 70;
         let clarityScore = 40 + Math.random() * 50;
         let rhythmDetected = Math.random() > 0.5; // 50/50 chance

         if (duration < 0.3) { // Penalize very short sounds
             avgVolume *= (duration / 0.3); pitchVar *= (duration / 0.3); clarityScore *= (duration / 0.3);
             rhythmDetected = false;
         }
        const estimatedType = this.guessAudioType(selectedItems, avgVolume, pitchVar, Math.random() * 0.3); // Simulate ZCR

        const results = {
             duration: Math.max(0.1, duration), // Ensure duration is not zero
             volume: Math.min(100, Math.max(0, Math.round(avgVolume))),
             peakAmplitude: Math.random() * 0.8 + 0.1, // Peak between 0.1 and 0.9
             pitchVariation: Math.min(100, Math.max(0, Math.round(pitchVar))),
             clarity: Math.min(100, Math.max(0, Math.round(clarityScore))),
             rhythmDetected: rhythmDetected, estimatedType: estimatedType,
             rawVolumeData: volumeData.length > 0 ? volumeData : [{time:0, volume: avgVolume}, {time: Math.max(0.1, duration), volume: avgVolume}],
             rawWaveformPoints: []
        };
        console.log('🎶 模拟音频分析结果:', results);
        return results;
    }

    guessAudioType(selectedItems, volume, pitchVariation, normalizedZCR) {
        const allItemTypes = Object.keys(window.GAME_DATA.items);
        if (!allItemTypes.length) return 'unknown'; // Fallback if no items defined

        // Try matching with selected items first, using their analysis hints
        if (selectedItems && selectedItems.length > 0) {
            const matchedSelected = selectedItems.find(itemId => {
                const itemHint = window.GAME_DATA.items[itemId]?.analysisHint;
                if (!itemHint) return false;

                const volMatch = volume >= itemHint.volume.min && volume <= itemHint.volume.max;
                const pitchMatch = pitchVariation >= itemHint.pitchVariation.min && pitchVariation <= itemHint.pitchVariation.max;
                // Could add more complex matching, e.g., distance from center of range
                return volMatch && pitchMatch;
            });
            if (matchedSelected) {
                 console.log(`Guessed type '${matchedSelected}' based on selected items and characteristics.`);
                 return matchedSelected;
            }
        }

        // Generic heuristics if no selected item matches or no items selected
        if (volume > 75 && pitchVariation < 35) return 'metal';      // Loud, low pitch variation
        if (volume < 45 && pitchVariation > 65) return 'paper';      // Quiet, high pitch variation
        if (volume > 40 && pitchVariation < 30) return 'voice_low';  // Moderate volume, very low pitch variation
        if (volume > 30 && pitchVariation > 70) return 'voice_high'; // Moderate volume, very high pitch variation
        if (normalizedZCR !== null) { // Using ZCR for more nuanced guesses
             if (normalizedZCR > 0.20 && volume < 60 && pitchVariation > 50) return 'fabric'; // High ZCR (noisy), moderate volume, high pitch var
             if (normalizedZCR < 0.10 && volume > 50 && pitchVariation < 50) return 'wood';   // Low ZCR (more tonal/percussive), good volume, moderate pitch var
        }

        // Fallback: random guess from available (selected or all) items
        const availableItemIds = selectedItems && selectedItems.length > 0 ? selectedItems : allItemTypes;
         if(availableItemIds.length > 0) {
              const randomGuess = availableItemIds[Math.floor(Math.random() * availableItemIds.length)];
              console.log(`Guessed type '${randomGuess}' as fallback.`);
              return randomGuess;
         }
        return allItemTypes[0] || 'unknown'; // Absolute fallback
    }


    playBackgroundSound(soundId) {
        const soundFile = window.AUDIO_ASSETS.bgm[soundId];
        if (!soundFile) { this.stopBackgroundSound(); return; }

        // Avoid restarting if the same BGM is already playing
        if (this.backgroundAudio && !this.backgroundAudio.paused) {
            try {
                const currentSrc = new URL(this.backgroundAudio.src).pathname;
                const requestedSrc = new URL(soundFile, window.location.href).pathname;
                if (currentSrc.endsWith(requestedSrc) || requestedSrc.endsWith(currentSrc)) return;
            } catch (e) { console.warn("Error comparing BGM URLs:", e); } // If URL parsing fails, proceed to stop/start
        }
        this.stopBackgroundSound(); // Stop any current BGM

        this.backgroundAudio = new Audio(soundFile);
        this.backgroundAudio.loop = true;
        this.backgroundAudio.volume = this.masterVolume * this.bgmVolume;

        this.backgroundAudio.play().catch(error => {
            console.warn(`背景音播放失败 (${soundId}):`, error);
             if (this.audioContext && this.audioContext.state === 'suspended') {
                 console.log('Audio Context suspended, attempting to add listener for BGM resume.');
                 const playBgmOnResume = () => {
                     if (this.backgroundAudio && this.backgroundAudio.paused && this.audioContext?.state === 'running') {
                         this.backgroundAudio.play().then(() => {
                            console.log('BGM play resumed successfully after user gesture.');
                         }).catch(e => console.warn("BGM play after resume failed:", e))
                         .finally(() => {
                            document.body.removeEventListener('click', playBgmOnResume, true);
                            document.body.removeEventListener('touchstart', playBgmOnResume, true);
                         });
                     } else { // Context not running or audio element gone, remove listeners
                          document.body.removeEventListener('click', playBgmOnResume, true);
                          document.body.removeEventListener('touchstart', playBgmOnResume, true);
                     }
                 };
                 document.body.addEventListener('click', playBgmOnResume, { capture: true, once: true });
                 document.body.addEventListener('touchstart', playBgmOnResume, { capture: true, once: true });
             } else if (this.app) {
                 this.app.showNotification('背景音乐播放失败，可能需要用户交互。', 'error');
             }
        });
    }

    stopBackgroundSound() {
        if (this.backgroundAudio) {
            this.backgroundAudio.pause();
            this.backgroundAudio.currentTime = 0; // Reset for next play
            this.backgroundAudio.src = ""; // Release resource
            this.backgroundAudio = null;
        }
    }

    setMasterVolume(volume) { // volume is 0-100
        this.masterVolume = Math.max(0, Math.min(100, volume)) / 100;
        if (this.backgroundAudio) this.backgroundAudio.volume = this.masterVolume * this.bgmVolume;
        this.activeSFX.forEach(audio => audio.volume = this.masterVolume * this.sfxVolume);
        console.log(`Master Volume set to ${Math.round(this.masterVolume*100)}%`);
    }
    setSFXVolume(volume) { // volume is 0-100
         this.sfxVolume = Math.max(0, Math.min(100, volume)) / 100;
         this.activeSFX.forEach(audio => audio.volume = this.masterVolume * this.sfxVolume);
         console.log(`SFX Volume set to ${Math.round(this.sfxVolume*100)}%`);
    }
    setBGMVolume(volume) { // volume is 0-100
         this.bgmVolume = Math.max(0, Math.min(100, volume)) / 100;
         if (this.backgroundAudio) this.backgroundAudio.volume = this.masterVolume * this.bgmVolume;
         console.log(`BGM Volume set to ${Math.round(this.bgmVolume*100)}%`);
    }

    async playSFX(type) {
        try {
            if (!this.audioContext) {
                console.warn('音频上下文不可用，尝试重新初始化...');
                this.init();
                if (!this.audioContext) return;
            }

            // 确保音频上下文处于运行状态
            await this.ensureAudioContextRunning();
            
            // 获取音效配置
            const sfxConfig = window.AUDIO_ASSETS?.sfx?.[type] || window.AUDIO_ASSETS?.ui?.[type];
            
            // 如果配置为null或未找到配置，使用生成的音效
            if (!sfxConfig) {
                switch(type) {
                    case 'click':
                        await this.playClickSound();
                        break;
                    case 'hover':
                        await this.playHoverSound();
                        break;
                    case 'error':
                    case 'error_negative':
                        await this.playErrorSound();
                        break;
                    case 'success':
                    case 'success_minor':
                    case 'success_major':
                        await this.playSuccessSound();
                        break;
                    case 'metal':
                        if (window.generateMetalSound) {
                            window.generateMetalSound(this.audioContext);
                        }
                        break;
                    case 'transition':
                    case 'modal_open':
                        await this.playTransitionSound();
                        break;
                    case 'modal_close':
                        await this.playModalCloseSound();
                        break;
                    default:
                        // 对于未知类型，使用通用音效
                        await this.playGenericSound();
                }
            } else {
                // 如果有具体的音频文件路径，使用Audio对象播放
                const audio = new Audio(sfxConfig);
                audio.volume = this.masterVolume * this.sfxVolume;
                try {
                    await audio.play();
                } catch (error) {
                    console.warn('外部音频文件播放失败，使用生成的音效:', error);
                    await this.playGenericSound();
                }
            }
        } catch (error) {
            console.error('播放音效失败:', error);
            // 只在真正的错误时显示通知，避免重复显示
            if (error.message !== '音频系统需要用户交互 (如点击屏幕) 才能启动。') {
                if (this.app) this.app.showNotification(`音效播放失败: ${error.message}`, 'error');
            }
        }
    }

    async playTransitionSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.2 * this.masterVolume * this.sfxVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
        
        return new Promise(resolve => setTimeout(resolve, 200));
    }

    async playModalCloseSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.15);
        
        gainNode.gain.setValueAtTime(0.2 * this.masterVolume * this.sfxVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.15);
        
        return new Promise(resolve => setTimeout(resolve, 150));
    }

    async playGenericSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.2 * this.masterVolume * this.sfxVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
        
        return new Promise(resolve => setTimeout(resolve, 100));
    }

    async playClickSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.3 * this.masterVolume * this.sfxVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.1);
        
        // 返回Promise以确保音效播放完成
        return new Promise(resolve => setTimeout(resolve, 100));
    }

    async playHoverSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.1 * this.masterVolume * this.sfxVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.05);
        
        return new Promise(resolve => setTimeout(resolve, 50));
    }

    async playErrorSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.3 * this.masterVolume * this.sfxVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
        
        return new Promise(resolve => setTimeout(resolve, 200));
    }

    async playSuccessSound() {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
        oscillator.frequency.setValueAtTime(880, this.audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3 * this.masterVolume * this.sfxVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.2);
        
        return new Promise(resolve => setTimeout(resolve, 200));
    }

    getSoundLibrarySample(itemId) {
        // 返回音效示例
        return {
            url: 'metal'  // 使用生成的音效
        };
    }
}
