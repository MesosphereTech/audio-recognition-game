// 确保GAME_DATA对象在页面加载时正确初始化
if (typeof window.GAME_DATA === 'undefined') {
    window.GAME_DATA = {};
}

// Game data and configuration
window.GAME_DATA = {
    items: { // These are timbre libraries/tools for dubbing
        metal: {
            id: 'metal',
            name: '金属碰撞',
            icon: 'assets/ui/icons/item_metal_kit_style.png',
            description: '钥匙、硬币、锅盖的撞击声',
            unlockScore: 0,
            analysisHint: {
                 volume: { min: 60, max: 100 }, pitchVariation: { min: 0, max: 40 },
                 rhythmExpected: false, duration: { min: 0.1, max: 1.5 }
             },
            unlockRequirements: "初始可用"
        },
        paper: {
            id: 'paper',
            name: '纸张撕裂',
            icon: 'assets/ui/icons/item_paper_kit_style.png',
            description: '撕纸、揉纸团、书页翻动',
            unlockScore: 0,
             analysisHint: {
                 volume: { min: 30, max: 70 }, pitchVariation: { min: 50, max: 100 },
                 rhythmExpected: false, duration: { min: 0.2, max: 2.0 }
             },
            unlockRequirements: "初始可用"
        },
        water: {
            id: 'water',
            name: '液体流动',
            icon: 'assets/ui/icons/item_water_kit_style.png',
            description: '倒水、滴水、气泡咕噜声',
            unlockScore: 0,
             analysisHint: {
                 volume: { min: 40, max: 80 }, pitchVariation: { min: 30, max: 80 },
                 rhythmExpected: false, duration: { min: 0.5, max: 3.0 }
             },
            unlockRequirements: "初始可用"
        },
        wood: {
            id: 'wood',
            name: '木头敲击',
            icon: 'assets/ui/icons/item_wood_kit_style.png',
            description: '敲击桌子、木块断裂声',
            unlockScore: 500, // Score needed to unlock
             analysisHint: {
                 volume: { min: 50, max: 90 }, pitchVariation: { min: 10, max: 60 },
                 rhythmExpected: true, duration: { min: 0.1, max: 1.0 }
             },
            unlockRequirements: '完成"怪兽的早餐协奏曲"并达到500总灵感',
        },
        glass: {
            id: 'glass',
            name: '玻璃碎裂',
            icon: 'assets/ui/icons/item_glass_kit_style.png',
            description: '玻璃杯碰撞、窗户碎裂声',
             unlockScore: 1000,
             analysisHint: {
                 volume: { min: 70, max: 100 }, pitchVariation: { min: 60, max: 100 },
                 rhythmExpected: false, duration: { min: 0.1, max: 1.0 }
             },
             unlockRequirements: '完成"雨夜霓虹追逐战"并达到1000总灵感',
        },
        plastic: {
            id: 'plastic',
            name: '塑料异响',
            icon: 'assets/ui/icons/item_plastic_kit_style.png',
            description: '塑料瓶挤压、玩具零件声',
             unlockScore: 700, // Adjusted
             analysisHint: {
                 volume: { min: 30, max: 70 }, pitchVariation: { min: 40, max: 90 },
                 rhythmExpected: false, duration: { min: 0.3, max: 2.5 }
             },
             unlockRequirements: '完成"厨房狂想曲"并达到1200总灵感'
        },
        fabric: {
            id: 'fabric',
            name: '布料摩擦',
            icon: 'assets/ui/icons/item_fabric_kit_style.png',
            description: '衣物摩擦、旗帜飘扬声',
            unlockScore: 1200,
            analysisHint: {
                volume: { min: 20, max: 60 },
                pitchVariation: { min: 50, max: 90 },
                rhythmExpected: false,
                duration: { min: 0.5, max: 3.0 }
            },
            unlockRequirements: '完成"厨房狂想曲"并达到1200总灵感'
        },
        electronic: {
            id: 'electronic',
            name: '古怪电子',
            icon: 'assets/ui/icons/item_electronic_kit_style.png',
            description: '老旧收音机、电流滋滋声',
            unlockScore: 1800,
             analysisHint: {
                 volume: { min: 40, max: 80 }, pitchVariation: { min: 30, max: 80 },
                 rhythmExpected: true, duration: { min: 0.5, max: 4.0 }
             },
             unlockRequirements: "达到玩家等级 3 (地下工作室解锁)"
        },
        voice_low: {
            id: 'voice_low',
            name: '低沉人声',
            icon: 'assets/ui/icons/item_voice_low_kit_style.png',
            description: '模仿怪兽低吼、巨人脚步的沉闷人声',
            unlockScore: 2500,
             analysisHint: {
                 volume: { min: 50, max: 90 }, pitchVariation: { min: 0, max: 30 },
                 rhythmExpected: true, duration: { min: 1.0, max: 5.0 }
             },
             unlockRequirements: "达到玩家等级 4 (广播电视塔解锁)"
        },
        voice_high: {
            id: 'voice_high',
            name: '尖细人声',
            icon: 'assets/ui/icons/item_voice_high_kit_style.png',
            description: '模仿小动物叫声、精灵耳语的尖细人声',
            unlockScore: 3000,
             analysisHint: {
                 volume: { min: 30, max: 70 }, pitchVariation: { min: 70, max: 100 },
                 rhythmExpected: true, duration: { min: 0.5, max: 3.0 }
             },
             unlockRequirements: "总灵感达到 3000"
        }
    },

    levels: [
        {
            id: 'level_001',
            title: '怪兽的早餐协奏曲',
            description: '笨拙蒸汽怪兽的早餐时光，充满金属碰撞和蒸汽声。',
            challengeDetails: '目标：1. @2.5s 清脆的金属餐具碰撞声 2. @8s 持续的蒸汽喷发声 3. @15s 怪兽沉闷有力的咀嚼声。\n情感：滑稽、混乱。使用合适的物品在关键时刻配音！',
            initialItems: ['metal', 'water', 'paper'],
            rewardsOnCompletion: { newItemId: 'wood', message: '新音效解锁：木头敲击！梆梆梆！' },
            difficulty: 'easy',
            duration: '0:25', duration_seconds: 25,
            rewards: { baseInspirationPoints: 120, inspirationMultiplier: 0.75 }, // Adjusted
            videoUrl: 'assets/video/level_001_placeholder_monster_breakfast.html',
             scoringTargets: [
                 { time: 2.5, expectedType: 'metal', volume: { min: 70, max: 100, weight: 1.5 }, pitchVariation: { min: 0, max: 50, weight: 0.8 }, rhythmExpected: false, duration: { min: 0.2, max: 0.8, weight: 1.0 }, scoreMultiplier: 1.2, description: "金属餐具碰撞" },
                 { time: 8.0, expectedType: 'water', volume: { min: 50, max: 80, weight: 1.0 }, pitchVariation: { min: 40, max: 90, weight: 1.0 }, rhythmExpected: false, duration: { min: 1.5, max: 3.0, weight: 1.2 }, scoreMultiplier: 1.0, description: "蒸汽喷发" },
                 { time: 15.2, expectedType: 'voice_low', volume: { min: 60, max: 90, weight: 1.2 }, pitchVariation: { min: 0, max: 40, weight: 1.5 }, rhythmExpected: true, duration: { min: 0.5, max: 1.5, weight: 1.0 }, scoreMultiplier: 1.5, description: "怪兽咀嚼" }
             ]
        },
        {
            id: 'level_002',
            title: '雨夜霓虹追逐战',
            description: '雨夜都市中的惊险追逐，脚步、警笛、心跳。',
            challengeDetails: '目标：1. @5s 急促的雨中脚步声 2. @20s 尖锐的远处警笛声 3. @35s 紧张的心跳声。\n情感：紧张、悬疑。把握节奏和氛围！',
            initialItems: ['water', 'metal', 'paper'],
            rewardsOnCompletion: { newItemId: 'glass', message: '新音效解锁：玻璃碎裂！叮铃哐啷！' }, // Changed to glass
            difficulty: 'easy',
            duration: '0:45', duration_seconds: 45,
            rewards: { baseInspirationPoints: 180, inspirationMultiplier: 0.7 }, // Adjusted
            videoUrl: 'assets/video/level_002_placeholder_rain_chase.mp4',
             scoringTargets: [
                 { time: 5.0, expectedType: 'water', volume: { min: 40, max: 70, weight: 1.0 }, pitchVariation: { min: 50, max: 90, weight: 1.2 }, rhythmExpected: true, duration: {min: 0.1, max: 0.5, weight: 1.0}, scoreMultiplier: 1.0, description: "雨中脚步" },
                 { time: 20.5, expectedType: 'electronic', volume: { min: 50, max: 80, weight: 1.5 }, pitchVariation: { min: 30, max: 80, weight: 1.0 }, rhythmExpected: true, duration: {min: 2.0, max: 4.0, weight: 1.0}, scoreMultiplier: 1.2, description: "警笛声 (高频)" },
                 { time: 35.0, expectedType: 'voice_low', volume: { min: 30, max: 60, weight: 1.0 }, pitchVariation: { min: 0, max: 40, weight: 1.0 }, rhythmExpected: true, duration: {min: 0.5, max: 1.0, weight: 1.2}, scoreMultiplier: 0.8, description: "心跳声 (低沉)" }
             ]
        },
        {
            id: 'level_003',
            title: '厨房狂想曲',
            description: '厨房内的日常与意外，切菜、翻炒、碗碟碎裂。',
            challengeDetails: '目标：1. @10s 快速清脆的切菜声 2. @30s 锅铲滋啦作响的翻炒声 3. @45s 碗碟突然摔碎的惊吓声。\n情感：生活化、小意外。展现你的厨艺音效！',
            initialItems: ['metal', 'wood', 'water', 'glass', 'plastic'],
            rewardsOnCompletion: { newItemId: 'fabric', message: '新音效解锁：布料摩擦！沙沙沙！' },
            difficulty: 'medium',
            duration: '1:00', duration_seconds: 60,
            rewards: { baseInspirationPoints: 250, inspirationMultiplier: 0.8 }, // Adjusted
            videoUrl: 'assets/video/level_003_silent.mp4',
             scoringTargets: [
                 { time: 10.3, expectedType: 'wood', volume: { min: 50, max: 80, weight: 1.2 }, pitchVariation: { min: 10, max: 50, weight: 1.0 }, rhythmExpected: true, duration: {min: 0.1, max: 0.4, weight: 1.0}, scoreMultiplier: 1.1, description: "切菜声 (快速、清脆)" },
                 { time: 30.5, expectedType: 'metal', volume: { min: 60, max: 90, weight: 1.5 }, pitchVariation: { min: 20, max: 60, weight: 1.0 }, rhythmExpected: true, duration: {min: 0.8, max: 2.0, weight: 1.0}, scoreMultiplier: 1.3, description: "锅铲翻炒 (滋啦作响)" },
                 { time: 45.8, expectedType: 'glass', volume: { min: 80, max: 100, weight: 2.0 }, pitchVariation: { min: 70, max: 100, weight: 1.5 }, rhythmExpected: false, duration: {min: 0.5, max: 1.2, weight: 1.5}, scoreMultiplier: 1.5, description: "碗碟摔碎 (突然惊吓)" }
             ]
        },
    ],

    shopItems: [
        {
            id: 'shop_reverb_light',
            name: '轻微回声效果器',
            description: '为你的配音添加轻微的回声，增加空间感。',
            price: 200, // Adjusted
            category: 'effect',
            icon: 'assets/ui/icons/shop_reverb_kit_style.png',
            effectDescription: "评分时，若清晰度良好，创意分小幅提升。",
            effect: { type: 'reverb', strength: 'light', bonusCategory: 'creativity', bonusPoints: 5, condition: { clarityMin: 60 } }
        },
        {
            id: 'shop_bass_boost',
            name: '低音猛击喇叭',
            description: '增强录音的低频，让声音更有冲击力。',
            price: 400, // Adjusted
            category: 'effect',
            icon: 'assets/ui/icons/shop_bassboost_kit_style.png',
            effectDescription: "评分时，若音量高且音调变化低，表现分小幅提升。",
            effect: { type: 'eq_bass_boost', bonusCategory: 'performance', bonusPoints: 7, condition: { volumeMin: 70, pitchVariationMax: 40 } }
        },
        {
            id: 'shop_vintage_mic',
            name: '复古麦克风滤镜',
            description: '模拟老式麦克风的温暖音质，带点滋滋声。',
            price: 600, // Adjusted
            category: 'effect',
            icon: 'assets/ui/icons/shop_mic_filter_kit_style.png',
            effectDescription: "评分时，创意分获得风格加成，表现匹配容错略微提高。",
            effect: { type: 'filter_vintage', bonusCategory: 'creativity', bonusPoints: 8, performanceToleranceBoost: 5 } // 5% tolerance boost
        }
    ],

    scoring: {
        weights: { timing: 0.40, performance: 0.35, creativity: 0.25 },
        timing: {
            perfectWindowFactor: 0.3, goodWindowFactor: 0.7, okWindowFactor: 1.0,
            basePointsPerCue: 100, missPenaltyFactor: 0.2
        },
        performance: {
            volumeMatchWeight: 0.30, pitchVariationMatchWeight: 0.25,
            clarityWeight: 0.20, durationMatchWeight: 0.25,
            rhythmBonusPoints: 15, targetValueTolerance: 25
        },
        creativity: {
            itemFitBonusBase: 30, itemComboBonusPerItem: 10,
            wildnessMaxBonus: 20,
            shopItemStyleBonusBase: 5 // Base bonus for any applicable shop item effect
        },
        starThresholds: { 3: 90, 2: 70, 1: 50 }
    },

    texts: {
        buttons: { warehouse: "怪奇仓库", shop: "声纳超市", settings: "调校参数" },
        messages: { loading: "加载中...", error: "发生错误！" },
        scoreComments: {
            excellent: '完美音痴！你就是声音的魔术师！真正的艺术家！',
            good: '相当不赖！很有内味儿了！继续保持！',
            fair: '还行还行！有点意思，下次更牛！',
            needsWork: '呃...再来一次？找找感觉，别灰心！',
        }
    },

    config: {
        version: "3.2.0-gameplay-deepen", // Updated version
        maxSimultaneousItems: 3, maxRecordingTime: 90,
        particleCount: 25, animationDuration: 400,
        playerLevels: [
            { level: 1, name: "阁楼录音间", unlockScore: 0, description: "在这充满旧物的神秘阁楼中开始你的配音之旅...", unlockMessage: "欢迎来到阁楼录音间！新手指引已开启！" },
            { level: 2, name: "杂物仓库", unlockScore: 750, description: "在尘封的仓库里，你发现了更多有趣的配音材料！", unlockMessage: "场景解锁：杂物仓库！更多物品槽已开放！"},
            { level: 3, name: "地下工作室", unlockScore: 2000, description: "你的配音技巧越来越娴熟，解锁了更专业的地下工作室！", unlockMessage: "场景解锁：地下工作室！高级设备已就绪！" },
            { level: 4, name: "广播电视塔", unlockScore: 5000, description: "登上城市之巅，用你的声音向世界广播！", unlockMessage: "场景解锁：广播电视塔！成为传奇配音员！" },
        ],
         cuePointTimingTolerance: 0.6
    }
};

window.AUDIO_ASSETS = {
    ui: {
        click: null,  // 使用 null 表示需要生成的音效
        hover: null,
        transition: null,
        success_minor: null,
        success_major: null,
        error_negative: null,
        modal_open: null,
        modal_close: null,
        item_unlock: null,
        level_unlock: null,
        purchase_success: null
    },
    sfx: {
        record_start: null,
        record_stop: null,
        item_select: null,
        submit_success: null,
        score_tick: null,
        score_final: null,
        video_preview_start: null,
        video_playback_start: null,
        cue_point_alert: null
    },
    bgm: {
        menu: null,
        level_select: null,
        game: null,
        shop: null
    },
    samples: {
        metal_preview: null,
        paper_preview: null,
        water_preview: null,
        wood_preview: null,
        glass_preview: null,
        plastic_preview: null,
        fabric_preview: null,
        electronic_preview: null,
        voice_low_preview: null,
        voice_high_preview: null
    }
};

// 如果window对象存在，将AUDIO_ASSETS添加到全局作用域
if (typeof window !== 'undefined') {
    window.AUDIO_ASSETS = AUDIO_ASSETS;
}

window.GAME_UTILS = {
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    calculateRangeMatchScore(value, targetMin, targetMax, tolerance = 20, strictness = 1.5) {
        if (targetMin == null || targetMax == null || value == null) return 0.5; // Default if targets are missing
        if (value >= targetMin && value <= targetMax) {
            return 1.0;
        }
        const lowerBound = targetMin * (1 - tolerance / 100);
        const upperBound = targetMax * (1 + tolerance / 100);

        if (value < targetMin && value >= lowerBound) {
            const score = Math.max(0, (value - lowerBound) / (targetMin - lowerBound));
            return Math.pow(score, strictness);
        }
        if (value > targetMax && value <= upperBound) {
            const score = Math.max(0, (upperBound - value) / (upperBound - targetMax));
            return Math.pow(score, strictness);
        }
        return 0.0;
    },
    lerp(start, end, t) { return start * (1 - t) + end * t; },
    clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
};

console.log(`📊 游戏数据配置已加载 (v${window.GAME_DATA.config.version})`);
