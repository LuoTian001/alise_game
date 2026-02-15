/**
 * Aris Game Logic (Refactored)
 * ----------------------------
 * 优化重点:
 * 1. 移除多语言冗余层级，扁平化配置。
 * 2. 使用 Fetch API 替代 XMLHttpRequest。
 * 3. 引入 GPU 加速动画逻辑，替代 setInterval。
 * 4. 适配 Hexo Butterfly PJAX 页面切换。
 */

// =========================================
// 1. 游戏配置 (Configuration)
// =========================================
const GAME_CONFIG = {
    // 音频资源列表 (支持相对路径)
    audioList: [
        "audio/1.mp3",
        "audio/2.mp3"
    ],
    // 文本资源 (支持数组形式的随机文案)
    texts: {
        "page-title": "Welcome to Aris",
        "doc-title": "邦卡卡邦",
        "page-descriptions": "给爱丽丝酱写的小网站，对，就是那个最可爱的《蔚蓝档案》角色！",
        "counter-descriptions": ["爱丽丝已经“邦卡卡邦！”了", "爱丽丝已经摇了"],
        "counter-unit": ["次", "次"],
        "counter-button": ["邦卡卡邦！", "SenSei！"],
    },
    // 图片资源预加载列表
    preloadImages: [
        "img/arisu1.gif",
        "img/arisu2.gif"
    ]
};

// =========================================
// 2. 资源管理器 (Resource Manager)
// =========================================
class ResourceManager {
    constructor() {
        this.audioCache = []; // 存储 Base64 音频
        this.isReady = false;
    }

    /**
     * 并发预加载所有资源
     * @param {Function} onProgress - 进度回调 (current, total)
     */
    async loadAll(onProgress) {
        const tasks = [];
        let loadedCount = 0;
        const total = GAME_CONFIG.audioList.length;

        // 1. 加载音频并转 Base64
        const audioTasks = GAME_CONFIG.audioList.map(async (url) => {
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                const base64 = await this._blobToBase64(blob);
                this.audioCache.push(base64);
            } catch (err) {
                console.error(`Failed to load audio: ${url}`, err);
            } finally {
                loadedCount++;
                if (onProgress) onProgress(loadedCount, total);
            }
        });

        // 2. 预加载图片 (利用浏览器缓存，无需转 Base64)
        GAME_CONFIG.preloadImages.forEach(src => {
            const img = new Image();
            img.src = src;
        });

        await Promise.all(audioTasks);
        this.isReady = true;
    }

    /**
     * Blob 转 Base64 辅助函数
     */
    _blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    /**
     * 获取随机音频数据
     */
    getRandomAudio() {
        if (this.audioCache.length === 0) return null;
        const idx = Math.floor(Math.random() * this.audioCache.length);
        return this.audioCache[idx];
    }
}

// =========================================
// 3. 游戏核心控制器 (Game Controller)
// =========================================
const ArisGame = {
    manager: null,
    count: 0,
    elements: {}, // 缓存 DOM 节点引用

    /**
     * 初始化游戏
     */
    init() {
        // 1. 绑定 DOM 元素
        this.elements = {
            btn: document.getElementById('counter-button'),
            counter: document.getElementById('local-counter'),
            loading: document.getElementById('loading'),
            texts: {
                title: document.getElementById('page-title'),
                desc: document.getElementById('page-descriptions'),
                ctDesc: document.getElementById('counter-descriptions'),
                ctUnit: document.getElementById('counter-unit')
            }
        };

        // 如果找不到核心按钮，说明不在游戏页面，直接退出
        if (!this.elements.btn) return;

        // 2. 恢复存档
        this.count = parseInt(localStorage.getItem('count-v2') || '0');
        this.updateDisplay(false); // 仅更新数字，不触发随机文本

        // 3. 启动资源加载
        this.manager = new ResourceManager();
        this.manager.loadAll((current, total) => {
            // 更新按钮上的加载进度
            const progress = Math.floor((current / total) * 100);
            this.elements.btn.innerText = `Loading ${progress}%`;
        }).then(() => {
            this.onGameReady();
        });
    },

    /**
     * 资源加载完毕后的回调
     */
    onGameReady() {
        if (this.elements.loading) this.elements.loading.remove();
        
        // 绑定点击事件
        this.elements.btn.onclick = (e) => this.handleInteraction(e);
        
        // 首次刷新文本
        this.refreshTexts();
    },

    /**
     * 处理点击交互
     */
    handleInteraction(e) {
        // 1. 更新数据
        this.count++;
        localStorage.setItem('count-v2', this.count);
        
        // 2. 触发视听反馈
        this.updateDisplay(true); // 更新数字 + 随机文案
        this.playAudio();
        this.spawnHerta();
        this.createRipple(e);
    },

    /**
     * 播放音效 (使用对象池思想或即时清理)
     */
    playAudio() {
        const source = this.manager.getRandomAudio();
        if (!source) return;

        const audio = new Audio(source);
        audio.volume = 0.6; // 稍微降低音量，避免刺耳
        // 播放结束立即销毁对象，防止内存泄漏
        audio.onended = () => {
            audio.remove();
            audio.srcObject = null;
        };
        audio.play().catch(e => console.warn("Audio play blocked", e));
    },

    /**
     * 生成 Herta 动画 (GPU 加速版)
     */
    spawnHerta() {
        const id = Math.floor(Math.random() * 2) + 1; // 随机 1 或 2
        const img = document.createElement('img');
        img.src = `img/arisu${id}.gif`;
        img.className = 'herta-animation-obj'; // 样式在 CSS 中定义
        
        // 动画结束后移除 DOM
        img.onanimationend = () => img.remove();
        
        document.body.appendChild(img);
    },

    /**
     * 按钮波纹特效
     */
    createRipple(e) {
        const btn = this.elements.btn;
        const ripple = document.createElement('span');
        const rect = btn.getBoundingClientRect();
        
        // 计算波纹直径
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.classList.add('ripple');

        btn.appendChild(ripple);
        
        // 动画时间与 CSS 保持一致 (400ms)
        setTimeout(() => ripple.remove(), 400);
    },

    /**
     * 更新界面显示
     * @param {boolean} randomizeText - 是否随机刷新文案
     */
    updateDisplay(randomizeText) {
        if (this.elements.counter) {
            this.elements.counter.innerText = this.count.toLocaleString('en-US');
        }

        if (randomizeText) {
            this.refreshTexts();
        }
    },

    /**
     * 刷新随机文案
     */
    refreshTexts() {
        const setRandomText = (elem, key) => {
            if (!elem || !GAME_CONFIG.texts[key]) return;
            const content = GAME_CONFIG.texts[key];
            elem.innerText = Array.isArray(content) 
                ? content[Math.floor(Math.random() * content.length)] 
                : content;
        };

        setRandomText(this.elements.btn, 'counter-button');
        setRandomText(this.elements.texts.ctDesc, 'counter-descriptions');
        setRandomText(this.elements.texts.ctUnit, 'counter-unit');
    }
};

// =========================================
// 4. 入口与 PJAX 适配 (Entry Point)
// =========================================

// 启动函数
function main() {
    // 简单的防抖，防止重复初始化
    if (window.arisGameInitialized) return;
    
    ArisGame.init();
    
    // 标记当前页面已初始化，但在 PJAX 离开时需要重置标记
    // 注意：这里不做严格的单例限制，因为 PJAX 会替换 DOM，ArisGame.init 内部会重新查找 DOM
}

// 监听 DOM 加载
document.addEventListener('DOMContentLoaded', main);

// 监听 PJAX 完成事件 (适配 Hexo Butterfly)
document.addEventListener('pjax:complete', () => {
    // PJAX 切换后，DOM 已变，重新运行初始化
    ArisGame.init();
});

// 监听 PJAX 开始事件 (可选：清理工作)
document.addEventListener('pjax:send', () => {
    // 如果有正在播放的循环音效或定时器，在这里清理
    // 当前版本主要依赖 CSS 动画和一次性事件，自动清理即可，无需额外操作
});