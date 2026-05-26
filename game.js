/**
 * SQUIRREL GAME — Complete 2D Endless Runner Game Engine
 * Pixel-perfect retro arcade style with dynamic scaling.
 * Built with HTML5 Canvas, Web Audio API, and vanilla JavaScript.
 */

// ═══════════════════════════════════════════════════
// CANVAS SETUP & DYNAMIC SIZING
// ═══════════════════════════════════════════════════
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let GROUND_Y = 0;
let DYNAMIC_SCALE = 3;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    GROUND_Y = canvas.height * 0.80;
    DYNAMIC_SCALE = Math.min(canvas.width / 800, canvas.height / 300) * 3;

    // Recalculate player size and ground snap position on resize
    if (typeof player !== 'undefined' && player.recalcSize) {
        player.recalcSize();
        if (player.isGrounded) {
            player.y = GROUND_Y - player.drawH;
        }
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ═══════════════════════════════════════════════════
// GAME STATES
// ═══════════════════════════════════════════════════
const STATES = {
    INTRO: 'INTRO',
    HOME: 'HOME',
    PLAYING: 'PLAYING',
    DEATH_ANIMATION: 'DEATH_ANIMATION',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY'
};
let currentState = STATES.INTRO;

// ═══════════════════════════════════════════════════
// ASSETS
// ═══════════════════════════════════════════════════
const assets = {
    bgLayer1: new Image(),
    bgLayer2: new Image(),
    bgLayer3: new Image(),
    tileset: new Image(),
    props: new Image(),
    player: new Image(),
    frog: new Image(),
    opossum: new Image(),
    bee: new Image(),
    acorn: new Image()
};

assets.bgLayer1.src = 'Assets/background/layer-1.png';
assets.bgLayer2.src = 'Assets/background/layer-2.png';
assets.bgLayer3.src = 'Assets/background/layer-3.png';
assets.tileset.src = 'Assets/tileset.png';
assets.props.src = 'Assets/props.png';
assets.player.src = 'Assets/player.png';
assets.frog.src = 'Assets/enemies/frog.png';
assets.opossum.src = 'Assets/enemies/opossum.png';
assets.bee.src = 'Assets/enemies/bee.png';
assets.acorn.src = 'Assets/acorn.png';

let assetsLoaded = 0;
const totalAssets = Object.keys(assets).length;
let isGameReady = false;

Object.values(assets).forEach(img => {
    img.onload = () => {
        assetsLoaded++;
        if (assetsLoaded === totalAssets) {
            isGameReady = true;
        }
    };
    img.onerror = () => {
        console.error('Failed to load asset:', img.src);
        assetsLoaded++;
        if (assetsLoaded === totalAssets) isGameReady = true;
    };
});

// ═══════════════════════════════════════════════════
// AUDIO
// ═══════════════════════════════════════════════════
let audioCtx = null;

function getMusicAudio() { return document.getElementById('bgMusic'); }

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playMusic() {
    initAudio();
    const music = getMusicAudio();
    if (music) {
        music.volume = 0.35;
        music.play().catch(() => {});
    }
}

function stopMusic() {
    const music = getMusicAudio();
    if (music) {
        music.pause();
        music.currentTime = 0;
    }
}

function pauseMusic() {
    const music = getMusicAudio();
    if (music) music.pause();
}

function playJumpSound(isSecond) {
    if (!audioCtx) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    const startFreq = isSecond ? 420 : 300;
    const endFreq = isSecond ? 700 : 550;
    osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.18);
}

function playCollectSound() {
    if (!audioCtx) return;
    initAudio();
    const osc1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    osc1.connect(g1); g1.connect(audioCtx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, audioCtx.currentTime);
    g1.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc1.start(); osc1.stop(audioCtx.currentTime + 0.08);

    const osc2 = audioCtx.createOscillator();
    const g2 = audioCtx.createGain();
    osc2.connect(g2); g2.connect(audioCtx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.06);
    g2.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.21);
    osc2.start(audioCtx.currentTime + 0.06);
    osc2.stop(audioCtx.currentTime + 0.21);
}

function playDeathSound() {
    if (!audioCtx) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    osc.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.6);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
    osc.start(); osc.stop(audioCtx.currentTime + 0.6);
}

// ═══════════════════════════════════════════════════
// GAME STATE VARIABLES
// ═══════════════════════════════════════════════════
const GRAVITY = 0.6;
const JUMP_VELOCITY = -12.0;
const WINNING_SCORE = 1000;

let gameSpeed = 3.0;
let score = 0;
let highScore = parseInt(localStorage.getItem('squirrelgame_hi') || '0', 10);
let frameCount = 0;
let flashTimer = 0;
let currentStage = 1;
let stageBannerTimer = 0;
let stageBannerText = '';

// Background positions
let bgX1 = 0, bgX2 = 0, bgX3 = 0, groundScrollX = 0;

// Spawn timers
let nextEnemySpawnTime = 0;
let nextAcornSpawnTime = 0;
let nextPropSpawnTime = 0;

// Entity lists
let enemies = [];
let acorns = [];
let propDecorations = [];
let scoreFloaters = [];

// ═══════════════════════════════════════════════════
// INTRO STATE
// ═══════════════════════════════════════════════════
let introStartTime = 0;
const INTRO_DURATION = 6.0;
let introPlayerX = -100;
let introLetters = [];
let introSkipped = false;

function initIntro() {
    introStartTime = performance.now() / 1000;
    introPlayerX = -100;
    introSkipped = false;
    introLetters = [];
    const title = "SQUIRREL GAME";
    for (let i = 0; i < title.length; i++) {
        introLetters.push({ char: title[i], y: -100, targetY: 0, arrived: false, delay: i * 0.08 });
    }
}

// ═══════════════════════════════════════════════════
// HOME SCREEN STATE
// ═══════════════════════════════════════════════════
let homeParticles = [];
let homeTime = 0;
let homeFadeIn = 0;
let homeTransitioning = false;
let homeTransitionAlpha = 0;

class LeafParticle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = -10;
        this.vx = 0;
        this.vy = 0.8 + Math.random() * 0.4;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = 0.02 + Math.random() * 0.02;
        this.alpha = 0.7 + Math.random() * 0.3;
        this.size = 3 + Math.random() * 3;
        this.color = Math.random() > 0.5 ? '#f0a500' : '#7ec850';
        this.phaseOffset = Math.random() * Math.PI * 2;
    }
    update(t) {
        this.x += Math.sin(t * 1.5 + this.phaseOffset) * 0.3;
        this.y += this.vy;
        this.rotation += this.rotSpeed;
        if (this.y > GROUND_Y) this.alpha -= 0.03;
    }
    draw() {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size * 0.6, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size * 0.6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// ═══════════════════════════════════════════════════
// GAME OVER STATE
// ═══════════════════════════════════════════════════
let gameOverTime = 0;
let gameOverTitleY = -100;
let gameOverSaved = false;
let gameOverMouseX = 0;
let gameOverMouseY = 0;
let newHighScore = false;

// ═══════════════════════════════════════════════════
// PLAYER
// ═══════════════════════════════════════════════════
const player = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    drawW: 0,
    drawH: 0,
    velY: 0,
    isGrounded: true,
    jumpsLeft: 2,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    deathTimer: 0,

    recalcSize() {
        this.drawW = 90 * (DYNAMIC_SCALE / 3);
        this.drawH = 58 * (DYNAMIC_SCALE / 3);
        this.width = 14 * DYNAMIC_SCALE;
        this.height = 19 * DYNAMIC_SCALE;
        this.x = canvas.width * 0.12;
    },

    reset() {
        this.recalcSize();
        this.y = GROUND_Y - this.drawH;
        this.velY = 0;
        this.isGrounded = true;
        this.jumpsLeft = 2;
        this.animState = 'run';
        this.animFrame = 0;
        this.animTimer = 0;
        this.deathTimer = 0;
    },

    jump() {
        if (this.jumpsLeft <= 0 || currentState === STATES.DEATH_ANIMATION) return;
        const isSecond = (this.jumpsLeft === 1);
        this.velY = isSecond ? JUMP_VELOCITY * 0.85 : JUMP_VELOCITY;
        this.jumpsLeft--;
        this.isGrounded = false;
        playJumpSound(isSecond);
    },

    update(speed) {
        // Gravity
        this.velY += GRAVITY;
        this.y += this.velY;

        if (this.y + this.drawH >= GROUND_Y) {
            this.y = GROUND_Y - this.drawH;
            this.velY = 0;
            this.isGrounded = true;
            this.jumpsLeft = 2;
        }

        // Animation state
        if (currentState === STATES.DEATH_ANIMATION) {
            this.animState = 'death';
        } else if (!this.isGrounded) {
            this.animState = this.velY < 0 ? 'jump' : 'fall';
        } else {
            this.animState = 'run';
        }

        // Animation timing
        this.animTimer++;
        if (this.animState === 'run') {
            if (this.animTimer >= 6) {
                this.animFrame = (this.animFrame + 1) % 6;
                this.animTimer = 0;
            }
        } else if (this.animState === 'jump' || this.animState === 'fall') {
            this.animFrame = 0;
        } else if (this.animState === 'death') {
            if (this.animTimer >= 8) {
                this.animFrame = (this.animFrame + 1) % 6;
                this.animTimer = 0;
            }
        } else { // idle
            if (this.animTimer >= 10) {
                this.animFrame = (this.animFrame + 1) % 4;
                this.animTimer = 0;
            }
        }
    },

    draw(overrideState, overrideX, overrideY, scaleMultiplier) {
        ctx.imageSmoothingEnabled = false;
        const state = overrideState || this.animState;
        let spriteIndex = 0;
        if (state === 'run') spriteIndex = 4 + this.animFrame;
        else if (state === 'jump') spriteIndex = 10;
        else if (state === 'fall') spriteIndex = 11;
        else if (state === 'death') spriteIndex = 12 + this.animFrame;
        else spriteIndex = this.animFrame % 4; // idle

        const frameW = 90, frameH = 58;
        const sx = spriteIndex * frameW;
        const scale = DYNAMIC_SCALE * (scaleMultiplier || 1);

        const dw = frameW * (scale / 3);
        const dh = frameH * (scale / 3);
        // Draw so sprite bottom aligns with player hitbox bottom (feet on ground)
        const drawBaseX = (overrideX !== undefined ? overrideX : this.x);
        const drawBaseY = (overrideY !== undefined ? overrideY : this.y);
        // Center horizontally, align bottom
        const dx = drawBaseX - (dw - this.width) / 2;
        const dy = drawBaseY - (dh - this.height) + (dh - this.height);
        ctx.drawImage(assets.player, sx, 0, frameW, frameH, dx, dy, dw, dh);
    }
};

// ═══════════════════════════════════════════════════
// ENEMY CLASS
// ═══════════════════════════════════════════════════
class Enemy {
    constructor(type, x) {
        this.type = type;
        this.x = x;
        this.animFrame = 0;
        this.animTimer = 0;
        this.speedOffset = 0;

        if (type === 'frog') {
            this.frameWidth = 52;
            this.frameHeight = 45;
            this.drawH = this.frameHeight * (DYNAMIC_SCALE / 3);  // actual draw height
            this.drawW = this.frameWidth * (DYNAMIC_SCALE / 3);
            this.width = this.drawW * 0.65;   // hitbox narrower than sprite
            this.height = this.drawH * 0.75;  // hitbox shorter than sprite
            this.y = GROUND_Y - this.drawH;   // snap DRAW bottom to ground, not hitbox bottom
            this.frameCount = 8;
            this.sheet = assets.frog;
            this.offsetX = 21;
            this.offsetY = 18;
            this.animState = 'idle';
            this.velY = 0;
            this.isGrounded = true;
            this.speedOffset = -0.5;
            this._hopT = 0;
        } else if (type === 'opossum') {
            this.frameWidth = 37;
            this.frameHeight = 31;
            this.drawH = this.frameHeight * (DYNAMIC_SCALE / 3);
            this.drawW = this.frameWidth * (DYNAMIC_SCALE / 3);
            this.width = this.drawW * 0.70;
            this.height = this.drawH * 0.80;
            this.y = GROUND_Y - this.drawH;   // snap DRAW bottom to ground, not hitbox bottom
            this.frameCount = 8;
            this.sheet = assets.opossum;
            this.offsetX = 13;
            this.offsetY = 17;
            this.speedOffset = 0.8;
        } else if (type === 'bee') {
            this.frameWidth = 46;
            this.frameHeight = 49;
            this.drawH = this.frameHeight * (DYNAMIC_SCALE / 3);
            this.drawW = this.frameWidth * (DYNAMIC_SCALE / 3);
            this.width = this.drawW * 0.65;
            this.height = this.drawH * 0.70;
            this.y = canvas.height * 0.30;
            this.frameCount = 4;
            this.sheet = assets.bee;
            this.offsetX = 15;
            this.offsetY = 20;
            this.speedOffset = 0.2;
            this.sineTimer = Math.random() * Math.PI * 2;
            this.baseY = canvas.height * 0.30;
        }
    }

    update(speed) {
        this.x -= (speed + this.speedOffset);

        if (this.type === 'frog') {
            this._hopT += 0.05;
            const hopOffset = Math.abs(Math.sin(this._hopT * 3)) * 20;
            this.y = (GROUND_Y - this.drawH) - hopOffset;

            const sinVal = Math.sin(this._hopT * 3);
            if (Math.abs(sinVal) < 0.15) {
                this.animState = 'idle';
            } else if (sinVal > 0) {
                this.animState = 'jump';
            } else {
                this.animState = 'fall';
            }

            this.animTimer++;
            if (this.animState === 'idle') {
                if (this.animTimer % 8 === 0) this.animFrame = (this.animFrame + 1) % 4;
            } else if (this.animState === 'jump') {
                this.animFrame = 4 + (Math.floor(this.animTimer / 6) % 2);
            } else if (this.animState === 'fall') {
                this.animFrame = 6 + (Math.floor(this.animTimer / 6) % 2);
            }
        } else if (this.type === 'opossum') {
            this.animTimer++;
            if (this.animTimer >= 6) {
                this.animFrame = (this.animFrame + 1) % 8;
                this.animTimer = 0;
            }
        } else if (this.type === 'bee') {
            this.sineTimer += 0.03;
            this.y = this.baseY + Math.sin(this.sineTimer) * 20;
            this.animTimer++;
            if (this.animTimer >= 8) {
                this.animFrame = (this.animFrame + 1) % 4;
                this.animTimer = 0;
            }
        }
    }

    draw() {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        
        const scale = DYNAMIC_SCALE / 3;
        const dw = this.frameWidth * scale;
        const dh = this.frameHeight * scale;
        const sx = this.animFrame * this.frameWidth;
        
        const drawX = this.x - (dw - this.width) / 2;  // center sprite on hitbox
        const drawY = this.y - (dh - this.height) + (this.type === 'bee' ? 0 : (dh - this.height)); // align sprite bottom to hitbox bottom with correction to prevent ground floating
        
        // Flip horizontally so enemies face LEFT (toward player)
        ctx.translate(drawX + dw, drawY);
        ctx.scale(-1, 1);
        ctx.drawImage(
            this.sheet,
            sx, 0, this.frameWidth, this.frameHeight,
            0, 0, dw, dh
        );
        ctx.restore();
    }
}

// ═══════════════════════════════════════════════════
// ACORN CLASS
// ═══════════════════════════════════════════════════
class Acorn {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 16 * DYNAMIC_SCALE / 3;
        this.height = 14 * DYNAMIC_SCALE / 3;
        this.animFrame = 0;
        this.animTimer = 0;
        this.baseY = y;
        this.phaseOffset = Math.random() * Math.PI * 2;
    }

    update(speed) {
        this.x -= speed;
        this.y = this.baseY + Math.sin(performance.now() / 400 + this.phaseOffset) * 6;
        this.animTimer++;
        if (this.animTimer >= 8) {
            this.animFrame = (this.animFrame + 1) % 3;
            this.animTimer = 0;
        }
    }

    draw() {
        ctx.imageSmoothingEnabled = false;
        const sx = this.animFrame * 16;
        const scale = DYNAMIC_SCALE / 3;
        const dw = 16 * scale;
        const dh = 14 * scale;

        // Golden glow
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#f0a500';
        ctx.drawImage(assets.acorn, sx, 0, 16, 14, this.x, this.y, dw, dh);
        ctx.restore();
    }
}

// ═══════════════════════════════════════════════════
// PROP DECORATION CLASS
// ═══════════════════════════════════════════════════
class PropDecoration {
    constructor(type, x) {
        this.type = type;
        this.x = x;
        const propSheets = {
            'branch-01': { sx: 2, sy: 2, sw: 54, sh: 56 },
            'branch-02': { sx: 58, sy: 2, sw: 80, sh: 51 },
            'branch-03': { sx: 140, sy: 2, sw: 94, sh: 53 },
            'branch-04': { sx: 236, sy: 2, sw: 136, sh: 88 },
            'branch-05': { sx: 374, sy: 2, sw: 130, sh: 37 },
            'leaves': { sx: 506, sy: 2, sw: 150, sh: 103 }
        };
        const p = propSheets[type];
        this.sx = p.sx; this.sy = p.sy; this.sw = p.sw; this.sh = p.sh;
        const scale = DYNAMIC_SCALE / 3;
        this.width = this.sw * scale;
        this.height = this.sh * scale;
        if (type === 'leaves') {
            this.y = canvas.height * 0.05 + Math.random() * canvas.height * 0.1;
        } else {
            this.y = GROUND_Y - this.height + 6;
        }
    }

    update(speed) { this.x -= speed; }

    draw() {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(assets.props, this.sx, this.sy, this.sw, this.sh, this.x, this.y, this.width, this.height);
    }
}

// ═══════════════════════════════════════════════════
// SCORE FLOATER
// ═══════════════════════════════════════════════════
class ScoreFloater {
    constructor(x, y, text) {
        this.x = x; this.y = y; this.text = text;
        this.life = 60; this.maxLife = 60;
    }
    update() { this.y -= 1; this.life--; }
    draw() {
        const alpha = this.life / this.maxLife;
        const fontSize = Math.max(10, DYNAMIC_SCALE * 4);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `${fontSize}px "Press Start 2P"`;
        ctx.fillStyle = '#f0a500';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#000';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// ═══════════════════════════════════════════════════
// COLLISION
// ═══════════════════════════════════════════════════
function checkAABB(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
           a.y < b.y + b.height && a.y + a.height > b.y;
}

function checkCollisions() {
    for (let i = acorns.length - 1; i >= 0; i--) {
        if (checkAABB(player, acorns[i])) {
            scoreFloaters.push(new ScoreFloater(acorns[i].x, acorns[i].y, '+5'));
            acorns.splice(i, 1);
            score += 5;
            playCollectSound();
            flashTimer = 8;
        }
    }
    for (let i = 0; i < enemies.length; i++) {
        if (checkAABB(player, enemies[i])) {
            triggerDeathState();
            break;
        }
    }
}

function triggerDeathState() {
    currentState = STATES.DEATH_ANIMATION;
    player.animState = 'death';
    player.animFrame = 0;
    player.animTimer = 0;
    player.deathTimer = 0;
    pauseMusic();
    playDeathSound();
}

// ═══════════════════════════════════════════════════
// GAME INIT & RESET
// ═══════════════════════════════════════════════════
function resetGame() {
    gameSpeed = 3.0;
    score = 0;
    frameCount = 0;
    flashTimer = 0;
    currentStage = 1;
    stageBannerTimer = 180;
    stageBannerText = "STAGE 1: SUNSET VALLEY";
    bgX1 = 0; bgX2 = 0; bgX3 = 0; groundScrollX = 0;
    enemies = [];
    acorns = [];
    propDecorations = [];
    scoreFloaters = [];

    propDecorations.push(new PropDecoration('branch-01', canvas.width * 0.35));
    propDecorations.push(new PropDecoration('branch-05', canvas.width * 0.7));

    player.reset();

    const now = performance.now();
    nextEnemySpawnTime = now + 1500;
    nextAcornSpawnTime = now + 2000;
    nextPropSpawnTime = now + 1000;

    playMusic();
}

function startGame() {
    currentState = STATES.PLAYING;
    resetGame();
}

// ═══════════════════════════════════════════════════
// SPAWNS
// ═══════════════════════════════════════════════════
function handleSpawns(now) {
    if (now >= nextEnemySpawnTime) {
        const minI = 1200, maxI = 3200;
        const diff = Math.max(0.4, 3.0 / gameSpeed);
        nextEnemySpawnTime = now + minI + Math.random() * (maxI - minI) * diff;
        const r = Math.random();
        let type = 'opossum';
        if (r < 0.35) type = 'frog';
        else if (r < 0.60) type = 'bee';
        enemies.push(new Enemy(type, canvas.width + 100));
    }
    if (now >= nextAcornSpawnTime) {
        nextAcornSpawnTime = now + 2500 + Math.random() * 3000;
        const acornY = GROUND_Y * 0.4 + Math.random() * GROUND_Y * 0.25;
        acorns.push(new Acorn(canvas.width + 50, acornY));
    }
    if (now >= nextPropSpawnTime) {
        nextPropSpawnTime = now + 3000 + Math.random() * 5000;
        const types = ['branch-01', 'branch-02', 'branch-03', 'branch-04', 'branch-05', 'leaves'];
        propDecorations.push(new PropDecoration(types[Math.floor(Math.random() * types.length)], canvas.width + 200));
    }
}

// ═══════════════════════════════════════════════════
// DRAWING HELPERS
// ═══════════════════════════════════════════════════
function drawBackground(speedMultiplier) {
    ctx.imageSmoothingEnabled = false;
    const w = canvas.width, h = canvas.height;

    // Sky fallback
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, w, h);

    // Layer 1
    if (assets.bgLayer1.complete && assets.bgLayer1.naturalWidth) {
        ctx.drawImage(assets.bgLayer1, bgX1, 0, w, h);
        ctx.drawImage(assets.bgLayer1, bgX1 + w, 0, w, h);
    }
    // Layer 2
    if (assets.bgLayer2.complete && assets.bgLayer2.naturalWidth) {
        ctx.drawImage(assets.bgLayer2, bgX2, 0, w, h);
        ctx.drawImage(assets.bgLayer2, bgX2 + w, 0, w, h);
    }
    // Layer 3
    if (assets.bgLayer3.complete && assets.bgLayer3.naturalWidth) {
        ctx.drawImage(assets.bgLayer3, bgX3, 0, w, h);
        ctx.drawImage(assets.bgLayer3, bgX3 + w, 0, w, h);
    }
}

function drawGroundTiles() {
    ctx.imageSmoothingEnabled = false;
    const tileW = 16, tileH = 16;
    const upscaledSize = tileW * (DYNAMIC_SCALE / 3);
    const numTiles = Math.ceil(canvas.width / upscaledSize) + 2;

    for (let i = 0; i < numTiles; i++) {
        const dx = groundScrollX + (i * upscaledSize);
        ctx.drawImage(assets.tileset, 384, 96, tileW, tileH, dx, GROUND_Y, upscaledSize, upscaledSize);
        ctx.drawImage(assets.tileset, 384, 112, tileW, tileH, dx, GROUND_Y + upscaledSize, upscaledSize, upscaledSize);
        // Fill remaining below
        if (GROUND_Y + upscaledSize * 2 < canvas.height) {
            ctx.drawImage(assets.tileset, 384, 112, tileW, tileH, dx, GROUND_Y + upscaledSize * 2, upscaledSize, canvas.height - GROUND_Y - upscaledSize * 2);
        }
    }
}

function drawVignette() {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const outerR = Math.max(canvas.width, canvas.height) * 0.75;
    const innerR = outerR * 0.35;
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawHUD() {
    const fontSize = Math.max(8, Math.min(canvas.width * 0.015, 16));
    ctx.save();
    ctx.font = `${fontSize}px "Press Start 2P"`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    const rx = canvas.width - 20;
    const ry = 16;

    ctx.fillStyle = '#66fcf1';
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(102,252,241,0.4)';
    ctx.fillText('SCORE', rx - fontSize * 9, ry);
    ctx.fillStyle = '#f5e6c8';
    ctx.shadowBlur = 2;
    ctx.shadowColor = '#000';
    ctx.fillText(score.toString().padStart(6, '0'), rx, ry);

    ctx.fillStyle = '#66fcf1';
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'rgba(102,252,241,0.4)';
    ctx.fillText('BEST', rx - fontSize * 9, ry + fontSize + 8);
    ctx.fillStyle = '#f5e6c8';
    ctx.shadowBlur = 2;
    ctx.shadowColor = '#000';
    ctx.fillText(highScore.toString().padStart(6, '0'), rx, ry + fontSize + 8);

    ctx.restore();
}

function clampFont(min, vw, max) {
    const vwPx = canvas.width * vw / 100;
    return Math.max(min, Math.min(vwPx, max));
}

// ═══════════════════════════════════════════════════
// BOUNCE EASING
// ═══════════════════════════════════════════════════
function bounceEase(t) {
    if (t < 0) return 0;
    if (t > 1) return 1;
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
}

// ═══════════════════════════════════════════════════
// UPDATE
// ═══════════════════════════════════════════════════
function update(now) {
    if (currentState === STATES.PLAYING) {
        frameCount++;
        if (frameCount % 10 === 0) score += 1;
        if (gameSpeed < 10.0) gameSpeed += 0.0005;

        bgX1 -= (gameSpeed * 0.2);
        if (bgX1 <= -canvas.width) bgX1 += canvas.width;
        bgX2 -= (gameSpeed * 0.5);
        if (bgX2 <= -canvas.width) bgX2 += canvas.width;
        bgX3 -= gameSpeed;
        if (bgX3 <= -canvas.width) bgX3 += canvas.width;

        const tileSize = 16 * (DYNAMIC_SCALE / 3);
        groundScrollX -= gameSpeed;
        if (groundScrollX <= -tileSize) groundScrollX += tileSize;

        handleSpawns(now);
        player.update(gameSpeed);

        for (let i = propDecorations.length - 1; i >= 0; i--) {
            propDecorations[i].update(gameSpeed);
            if (propDecorations[i].x < -propDecorations[i].width) propDecorations.splice(i, 1);
        }
        for (let i = enemies.length - 1; i >= 0; i--) {
            enemies[i].update(gameSpeed);
            if (enemies[i].x < -200) enemies.splice(i, 1);
        }
        for (let i = acorns.length - 1; i >= 0; i--) {
            acorns[i].update(gameSpeed);
            if (acorns[i].x < -100) acorns.splice(i, 1);
        }
        for (let i = scoreFloaters.length - 1; i >= 0; i--) {
            scoreFloaters[i].update();
            if (scoreFloaters[i].life <= 0) scoreFloaters.splice(i, 1);
        }

        checkCollisions();

        // Stage transitions
        if (score >= WINNING_SCORE) {
            currentState = STATES.VICTORY;
            pauseMusic();
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('squirrelgame_hi', highScore.toString());
            }
        } else if (score >= 600 && currentStage < 3) {
            currentStage = 3;
            stageBannerTimer = 180;
            stageBannerText = "FINAL STAGE: GOLDEN RUN";
            gameSpeed += 0.8;
            playCollectSound();
        } else if (score >= 300 && currentStage < 2) {
            currentStage = 2;
            stageBannerTimer = 180;
            stageBannerText = "STAGE 2: MIDNIGHT WOODS";
            gameSpeed += 0.5;
            playCollectSound();
        }

        if (stageBannerTimer > 0) stageBannerTimer--;
        if (flashTimer > 0) flashTimer--;

    } else if (currentState === STATES.DEATH_ANIMATION) {
        player.update(0);
        player.deathTimer++;
        if (player.deathTimer >= 90) {
            currentState = STATES.GAME_OVER;
            gameOverTime = performance.now();
            gameOverTitleY = -100;
            gameOverSaved = false;
            newHighScore = false;
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('squirrelgame_hi', highScore.toString());
                newHighScore = true;
            }
        }
    } else if (currentState === STATES.HOME) {
        homeTime += 1 / 60;
        if (homeFadeIn < 1) homeFadeIn += 0.02;

        // Slow background scroll
        bgX1 -= 0.6;
        if (bgX1 <= -canvas.width) bgX1 += canvas.width;
        bgX2 -= 1.5;
        if (bgX2 <= -canvas.width) bgX2 += canvas.width;
        bgX3 -= 3.0;
        if (bgX3 <= -canvas.width) bgX3 += canvas.width;
        const tileSize = 16 * (DYNAMIC_SCALE / 3);
        groundScrollX -= 3.0;
        if (groundScrollX <= -tileSize) groundScrollX += tileSize;

        // Particles
        if (frameCount % 40 === 0) homeParticles.push(new LeafParticle());
        for (let i = homeParticles.length - 1; i >= 0; i--) {
            homeParticles[i].update(homeTime);
            if (homeParticles[i].alpha <= 0) homeParticles.splice(i, 1);
        }

        // Player idle animation
        player.animState = 'idle';
        player.animTimer++;
        if (player.animTimer >= 10) {
            player.animFrame = (player.animFrame + 1) % 4;
            player.animTimer = 0;
        }

        frameCount++;

        // Transition
        if (homeTransitioning) {
            homeTransitionAlpha += 0.025;
            if (homeTransitionAlpha >= 1) {
                homeTransitioning = false;
                homeTransitionAlpha = 0;
                startGame();
            }
        }
    } else if (currentState === STATES.INTRO) {
        const elapsed = performance.now() / 1000 - introStartTime;

        // Slow scroll for intro backgrounds
        bgX1 -= 2.4;
        if (bgX1 <= -canvas.width) bgX1 += canvas.width;
        bgX2 -= 6.0;
        if (bgX2 <= -canvas.width) bgX2 += canvas.width;
        bgX3 -= 12.0;
        if (bgX3 <= -canvas.width) bgX3 += canvas.width;
        const tileSize = 16 * (DYNAMIC_SCALE / 3);
        groundScrollX -= 12.0;
        if (groundScrollX <= -tileSize) groundScrollX += tileSize;

        // Scene 3: Player runs in
        if (elapsed >= 2.6 && elapsed < 4.2) {
            const sceneT = (elapsed - 2.6) / 1.6;
            introPlayerX = -100 + (canvas.width * 0.25 + 100) * Math.min(1, sceneT);
        }

        // Player idle anim during intro
        player.animTimer++;
        if (player.animTimer >= 6) {
            player.animFrame = (player.animFrame + 1) % 6;
            player.animTimer = 0;
        }

        if (elapsed >= INTRO_DURATION) {
            goToHome();
        }

        frameCount++;
    }
}

// ═══════════════════════════════════════════════════
// DRAW
// ═══════════════════════════════════════════════════
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);  // reset any leftover transforms
    ctx.lineWidth = 1;
    ctx.imageSmoothingEnabled = false;

    if (currentState === STATES.INTRO) {
        drawIntro();
    } else if (currentState === STATES.HOME) {
        drawHome();
    } else if (currentState === STATES.PLAYING || currentState === STATES.DEATH_ANIMATION) {
        drawGameplay();
    } else if (currentState === STATES.GAME_OVER) {
        drawGameplay(); // Keep last frame visible
        drawGameOver();
    } else if (currentState === STATES.VICTORY) {
        drawGameplay();
        drawVictory();
    }
}

function drawIntro() {
    const elapsed = performance.now() / 1000 - introStartTime;
    const w = canvas.width, h = canvas.height;

    // SCENE 1: 0.0 – 1.2s — Sun rising + text
    if (elapsed < 1.5) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        const fadeIn = Math.min(1, elapsed / 0.8);
        ctx.globalAlpha = fadeIn;

        // Draw pixel sun
        const sunY = h * 0.7 - (elapsed / 1.2) * h * 0.3;
        const sunR = Math.min(w, h) * 0.12;
        ctx.fillStyle = '#f0a500';
        ctx.beginPath();
        ctx.arc(w / 2, sunY, sunR, 0, Math.PI * 2);
        ctx.fill();

        // Sun rays
        ctx.strokeStyle = '#f0a500';
        ctx.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i + elapsed * 0.5;
            ctx.beginPath();
            ctx.moveTo(w / 2 + Math.cos(angle) * (sunR + 8), sunY + Math.sin(angle) * (sunR + 8));
            ctx.lineTo(w / 2 + Math.cos(angle) * (sunR + 25), sunY + Math.sin(angle) * (sunR + 25));
            ctx.stroke();
        }

        // Text
        if (elapsed > 0.3) {
            const textAlpha = Math.min(1, (elapsed - 0.3) / 0.5);
            ctx.globalAlpha = textAlpha;
            ctx.font = `${clampFont(14, 2, 22)}px "Press Start 2P"`;
            ctx.fillStyle = '#f0a500';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#f0a500';
            ctx.fillText('A woodland adventure...', w / 2, h * 0.85);
            ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineWidth = 1;

    // Cross-fade transition 1→2
    } else if (elapsed < 1.5) {
        // handled by overlap

    // SCENE 2: 1.2 – 2.6s — Fast parallax scroll
    } else if (elapsed < 2.9) {
        const sceneAlpha = elapsed < 1.7 ? (elapsed - 1.2) / 0.5 : (elapsed > 2.4 ? Math.max(0, 1 - (elapsed - 2.4) / 0.5) : 1);
        ctx.globalAlpha = Math.min(1, sceneAlpha);

        drawBackground(4);

        // Vignette
        drawVignette();

        // Text
        ctx.font = `${clampFont(12, 1.5, 18)}px "Press Start 2P"`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#000';
        ctx.fillText('The forest awakens...', w / 2, h * 0.78);
        ctx.shadowBlur = 0;

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

    // SCENE 3: 2.6 – 4.2s — Squirrel runs in
    } else if (elapsed < 4.5) {
        const sceneAlpha = elapsed < 3.0 ? (elapsed - 2.6) / 0.4 : 1;
        ctx.globalAlpha = Math.min(1, sceneAlpha);

        drawBackground(1);
        drawGroundTiles();

        // Draw player running in
        player.recalcSize();
        const playerY = GROUND_Y - player.drawH;

        // Camera shake on arrival
        let shakeX = 0;
        const arrivalT = (elapsed - 2.6) / 1.6;
        if (arrivalT > 0.8) {
            const shakeMag = Math.max(0, (1 - arrivalT) * 8);
            shakeX = Math.sin(elapsed * 30) * shakeMag;
        }

        ctx.save();
        ctx.translate(shakeX, 0);
        player.draw('run', introPlayerX, playerY);
        ctx.restore();

        // Text
        if (elapsed > 3.0) {
            const textAlpha = Math.min(1, (elapsed - 3.0) / 0.4);
            ctx.globalAlpha = textAlpha;
            ctx.font = `${clampFont(14, 2, 22)}px "Press Start 2P"`;
            ctx.fillStyle = '#f5e6c8';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#000';
            ctx.fillText('A squirrel on the run!', w / 2, h * 0.12);
            ctx.shadowBlur = 0;
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

    // SCENE 4: 4.2 – 6.0s — Logo reveal
    } else {
        drawBackground(0.3);
        drawGroundTiles();

        // Title letters drop in
        const titleFontSize = clampFont(28, 5, 56);
        ctx.font = `${titleFontSize}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const title = "SQUIRREL GAME";
        const totalW = ctx.measureText(title).width;
        let startX = (w - totalW) / 2;

        for (let i = 0; i < introLetters.length; i++) {
            const letter = introLetters[i];
            const letterT = (elapsed - 4.2 - letter.delay) / 0.4;
            const bounce = bounceEase(Math.min(1, Math.max(0, letterT)));
            const letterY = -titleFontSize + (h * 0.35 + titleFontSize) * bounce;

            const charW = ctx.measureText(letter.char).width;
            ctx.save();
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#000';
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            ctx.fillStyle = '#f0a500';
            ctx.fillText(letter.char, startX + charW / 2, letterY);
            ctx.restore();
            startX += charW;
        }

        // Blink subtitle
        if (elapsed > 5.0) {
            const blinkOn = Math.floor(elapsed / 0.4) % 2 === 0;
            if (blinkOn) {
                ctx.font = `${clampFont(8, 1.2, 14)}px "Press Start 2P"`;
                ctx.fillStyle = '#66fcf1';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 4;
                ctx.shadowColor = '#66fcf1';
                ctx.fillText('Press SPACE or TAP to begin', w / 2, h * 0.55);
                ctx.shadowBlur = 0;
            }
        }

        drawVignette();

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 1;
    }
}

function drawHome() {
    const w = canvas.width, h = canvas.height;
    const t = homeTime;

    // Layer 1: Background
    drawBackground(0.3);

    // Layer 5: Props (home screen decorative)
    // Draw some static props near ground
    // (We use propDecorations array which we populate on home entry)

    // Layer 6: Acorn bobbing decorations
    // Draw 2-3 floating acorns
    for (let i = 0; i < 3; i++) {
        if (!assets.acorn.complete) break;
        const ax = w * (0.55 + i * 0.15);
        const ay = GROUND_Y * 0.5 + Math.sin(t * 1.5 + i * 2) * 8;
        const scale = DYNAMIC_SCALE / 3;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#f0a500';
        const frame = Math.floor(t * 5 + i) % 3;
        ctx.drawImage(assets.acorn, frame * 16, 0, 16, 14, ax, ay, 16 * scale, 14 * scale);
        ctx.restore();
    }

    // Layer 7: Ground tiles
    drawGroundTiles();

    // Layer 3: Player idle
    player.recalcSize();
    const playerX = w * 0.18;
    const playerY = GROUND_Y - player.drawH;
    const breathScale = 1 + Math.sin(t * 2) * 0.02;
    player.draw('idle', playerX, playerY, breathScale);

    // Layer 4: Title Card
    const boxW = w * 0.55;
    const boxH = h * 0.28;
    const boxX = (w - boxW) / 2;
    const boxY = h * 0.12;

    ctx.fillStyle = 'rgba(10,10,20,0.75)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = '#f0a500';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Spinning sun icon
    const sunCx = w / 2;
    const sunCy = boxY + boxH * 0.18;
    const sunR = Math.min(boxW, boxH) * 0.08;
    ctx.save();
    ctx.translate(sunCx, sunCy);
    ctx.rotate(t * 0.5);
    ctx.fillStyle = '#f0a500';
    ctx.beginPath();
    ctx.arc(0, 0, sunR, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i;
        ctx.strokeStyle = '#f0a500';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * (sunR + 2), Math.sin(angle) * (sunR + 2));
        ctx.lineTo(Math.cos(angle) * (sunR + 8), Math.sin(angle) * (sunR + 8));
        ctx.stroke();
    }
    ctx.restore();

    // "SQUIRREL" text
    const titleSize1 = clampFont(20, 3.5, 42);
    ctx.font = `${titleSize1}px "Press Start 2P"`;
    ctx.fillStyle = '#f0a500';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.shadowColor = '#000';
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.fillText('SQUIRREL', w / 2, boxY + boxH * 0.42);

    // Divider line
    ctx.strokeStyle = '#f0a500';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(boxX + boxW * 0.2, boxY + boxH * 0.55);
    ctx.lineTo(boxX + boxW * 0.8, boxY + boxH * 0.55);
    ctx.stroke();

    // "GAME" text
    ctx.fillText('GAME', w / 2, boxY + boxH * 0.72);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Layer 5: Control hints
    const hintBoxW = w * 0.45;
    const hintBoxH = h * 0.12;
    const hintBoxX = (w - hintBoxW) / 2;
    const hintBoxY = boxY + boxH + h * 0.04;

    ctx.fillStyle = 'rgba(10,10,20,0.6)';
    ctx.fillRect(hintBoxX, hintBoxY, hintBoxW, hintBoxH);
    ctx.strokeStyle = 'rgba(240,165,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hintBoxX, hintBoxY, hintBoxW, hintBoxH);

    const hintSize = clampFont(7, 1, 11);
    ctx.font = `${hintSize}px "Press Start 2P"`;
    ctx.fillStyle = '#f5e6c8';
    ctx.textAlign = 'center';
    ctx.fillText('[ SPACE ]  or  [ TAP ]  →  JUMP / START', w / 2, hintBoxY + hintBoxH * 0.4);
    ctx.fillStyle = '#99ddb8';
    ctx.fillText('Double jump supported!', w / 2, hintBoxY + hintBoxH * 0.75);

    // Layer 6: Score ticker at bottom
    const tickerY = h * 0.90;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, tickerY, w, h * 0.06);
    const tickerSize = clampFont(7, 1, 11);
    ctx.font = `${tickerSize}px "Press Start 2P"`;
    ctx.fillStyle = '#f0a500';
    ctx.textAlign = 'left';
    const tickerText = `BEST: ${highScore.toString().padStart(6, '0')}     ★     Squirrel Game  ·  Presented by Naveen Kumar     ★     `;
    const tickerW = ctx.measureText(tickerText).width;
    const tickerOffset = (t * 60) % (tickerW + w);
    ctx.fillText(tickerText, w - tickerOffset, tickerY + h * 0.035);
    ctx.fillText(tickerText, w - tickerOffset + tickerW, tickerY + h * 0.035);

    // Layer 7: Particles
    for (const p of homeParticles) p.draw();

    // Layer 8: Vignette
    drawVignette();

    // Fade-to-black transition
    if (homeTransitioning) {
        ctx.fillStyle = `rgba(0,0,0,${homeTransitionAlpha})`;
        ctx.fillRect(0, 0, w, h);
    }
}

function drawGameplay() {
    const w = canvas.width, h = canvas.height;

    // 1-3: Background layers
    drawBackground(1);

    // 4: Props
    for (const p of propDecorations) p.draw();

    // 5: Acorns
    for (const a of acorns) a.draw();

    // 6: Ground tiles
    drawGroundTiles();

    // 7: Enemies
    for (const e of enemies) e.draw();

    // Ground enemy shadows
    for (const e of enemies) {
        if (e.type === 'bee') continue;  // no shadow for flying enemy
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        const shadowW = (e.drawW || e.frameWidth * DYNAMIC_SCALE / 3) * 0.55;
        ctx.ellipse(
            e.x + (e.width / 2),
            GROUND_Y + 3,
            shadowW, 5,
            0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }

    // Player shadow
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(
        player.x + player.width / 2,
        GROUND_Y + 3,
        player.width * 0.45, 5,
        0, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.closePath();
    ctx.restore();

    // 8: Player
    player.draw();

    // 9: Score floaters
    for (const f of scoreFloaters) f.draw();

    // Stage tints
    if (currentState === STATES.PLAYING || currentState === STATES.DEATH_ANIMATION || currentState === STATES.GAME_OVER || currentState === STATES.VICTORY) {
        if (currentStage === 2) {
            ctx.fillStyle = 'rgba(10,15,60,0.35)';
            ctx.fillRect(0, 0, w, h);
        } else if (currentStage === 3) {
            ctx.fillStyle = 'rgba(255,170,0,0.18)';
            ctx.fillRect(0, 0, w, h);
        }
    }

    // Stage banner
    if (stageBannerTimer > 0) {
        const bannerW = w * 0.55;
        const bannerH = h * 0.15;
        const bannerX = (w - bannerW) / 2;
        const bannerY = h * 0.35;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
        ctx.strokeStyle = currentStage === 3 ? '#ffd700' : '#66fcf1';
        ctx.lineWidth = 3;
        ctx.strokeRect(bannerX, bannerY, bannerW, bannerH);
        ctx.font = `${clampFont(12, 2, 22)}px "Press Start 2P"`;
        ctx.fillStyle = currentStage === 3 ? '#ffd700' : '#66fcf1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stageBannerText, w / 2, bannerY + bannerH / 2);
    }

    // Flash
    if (flashTimer > 0) {
        ctx.fillStyle = `rgba(102,252,241,${flashTimer * 0.04})`;
        ctx.fillRect(0, 0, w, h);
    }

    // HUD
    drawHUD();

    // Vignette
    drawVignette();
}

function drawGameOver() {
    const w = canvas.width, h = canvas.height;
    const elapsed = (performance.now() - gameOverTime) / 1000;

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);

    // Keep player death sprite visible (already drawn in drawGameplay)

    // "GAME OVER" text drops from top with bounce
    const dropT = Math.min(1, elapsed / 0.5);
    const titleTargetY = h * 0.25;
    gameOverTitleY = -h * 0.15 + (titleTargetY + h * 0.15) * bounceEase(dropT);

    const goFontSize = clampFont(24, 4, 48);
    ctx.font = `${goFontSize}px "Press Start 2P"`;
    ctx.fillStyle = '#ff007f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff007f';
    ctx.fillText('GAME OVER', w / 2, gameOverTitleY);
    ctx.shadowBlur = 0;

    // Score panel
    if (elapsed > 0.5) {
        const panelW = w * 0.4;
        const panelH = h * 0.28;
        const panelX = (w - panelW) / 2;
        const panelY = h * 0.38;

        ctx.fillStyle = 'rgba(10,10,20,0.8)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = '#f0a500';
        ctx.lineWidth = 2;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        const scoreFontSize = clampFont(10, 1.5, 16);
        ctx.font = `${scoreFontSize}px "Press Start 2P"`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(`SCORE: ${score.toString().padStart(6, '0')}`, w / 2, panelY + panelH * 0.3);

        // High score (flashes amber if beaten)
        if (newHighScore) {
            const flash = Math.floor(elapsed * 4) % 2 === 0;
            ctx.fillStyle = flash ? '#f0a500' : '#ffd700';
        } else {
            ctx.fillStyle = '#ffd700';
        }
        ctx.fillText(`BEST: ${highScore.toString().padStart(6, '0')}`, w / 2, panelY + panelH * 0.55);

        if (newHighScore) {
            ctx.font = `${clampFont(6, 0.8, 10)}px "Press Start 2P"`;
            ctx.fillStyle = '#66fcf1';
            ctx.fillText('★ NEW HIGH SCORE! ★', w / 2, panelY + panelH * 0.75);
        }

        // Buttons
        const btnW = panelW * 0.42;
        const btnH = h * 0.07;
        const btnY = panelY + panelH + h * 0.03;
        const restartBtnX = w / 2 - btnW - 10;
        const homeBtnX = w / 2 + 10;

        // Store button positions for click detection
        gameOverRestartBtn = { x: restartBtnX, y: btnY, w: btnW, h: btnH };
        gameOverHomeBtn = { x: homeBtnX, y: btnY, w: btnW, h: btnH };

        // Restart button
        const rHover = isPointInRect(gameOverMouseX, gameOverMouseY, restartBtnX, btnY, btnW, btnH);
        ctx.fillStyle = rHover ? '#66fcf1' : 'rgba(10,10,20,0.8)';
        ctx.fillRect(restartBtnX, btnY, btnW, btnH);
        ctx.strokeStyle = '#66fcf1';
        ctx.lineWidth = 2;
        ctx.strokeRect(restartBtnX, btnY, btnW, btnH);
        ctx.font = `${clampFont(8, 1, 12)}px "Press Start 2P"`;
        ctx.fillStyle = rHover ? '#0b0c10' : '#66fcf1';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RESTART', restartBtnX + btnW / 2, btnY + btnH / 2);

        // Home button
        const hHover = isPointInRect(gameOverMouseX, gameOverMouseY, homeBtnX, btnY, btnW, btnH);
        ctx.fillStyle = hHover ? '#ff007f' : 'rgba(10,10,20,0.8)';
        ctx.fillRect(homeBtnX, btnY, btnW, btnH);
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 2;
        ctx.strokeRect(homeBtnX, btnY, btnW, btnH);
        ctx.fillStyle = hHover ? '#fff' : '#ff007f';
        ctx.fillText('HOME', homeBtnX + btnW / 2, btnY + btnH / 2);

        // Blink text
        const blinkOn = Math.floor(elapsed / 0.4) % 2 === 0;
        if (blinkOn) {
            ctx.font = `${clampFont(7, 1, 10)}px "Press Start 2P"`;
            ctx.fillStyle = '#66fcf1';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#66fcf1';
            ctx.fillText('Press SPACE to Restart', w / 2, btnY + btnH + h * 0.05);
            ctx.shadowBlur = 0;
        }
    }
}

function drawVictory() {
    const w = canvas.width, h = canvas.height;
    const elapsed = (performance.now() - gameOverTime) / 1000 || 0;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);

    const titleSize = clampFont(24, 4, 48);
    ctx.font = `${titleSize}px "Press Start 2P"`;
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ffd700';
    ctx.fillText('VICTORY!', w / 2, h * 0.25);
    ctx.shadowBlur = 0;

    ctx.font = `${clampFont(10, 1.5, 16)}px "Press Start 2P"`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`FINAL SCORE: ${score.toString().padStart(6, '0')}`, w / 2, h * 0.42);

    ctx.fillStyle = '#66fcf1';
    ctx.font = `${clampFont(8, 1.2, 14)}px "Press Start 2P"`;
    ctx.fillText('YOU ESCAPED THE SQUIRREL WOODS!', w / 2, h * 0.52);

    const blinkOn = Math.floor(performance.now() / 400) % 2 === 0;
    if (blinkOn) {
        ctx.fillStyle = '#ffd700';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffd700';
        ctx.fillText('Press SPACE to Restart', w / 2, h * 0.68);
        ctx.shadowBlur = 0;
    }
}

// ═══════════════════════════════════════════════════
// BUTTON HIT TEST
// ═══════════════════════════════════════════════════
let gameOverRestartBtn = null;
let gameOverHomeBtn = null;

function isPointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// ═══════════════════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════════════════
function gameLoop(now) {
    update(now);
    draw();
    requestAnimationFrame(gameLoop);
}

// ═══════════════════════════════════════════════════
// STATE TRANSITIONS
// ═══════════════════════════════════════════════════
function goToHome() {
    currentState = STATES.HOME;
    homeTime = 0;
    homeFadeIn = 0;
    homeTransitioning = false;
    homeTransitionAlpha = 0;
    homeParticles = [];
    frameCount = 0;
    bgX1 = 0; bgX2 = 0; bgX3 = 0; groundScrollX = 0;

    player.recalcSize();
    player.animState = 'idle';
    player.animFrame = 0;
    player.animTimer = 0;
    player.y = GROUND_Y - player.drawH;
}

function handleHomeStart() {
    initAudio();
    if (!homeTransitioning) {
        homeTransitioning = true;
        homeTransitionAlpha = 0;
    }
}

// ═══════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════
function handleActionInput(e) {
    initAudio();

    if (currentState === STATES.INTRO) {
        // Skip intro
        introSkipped = true;
        goToHome();
    } else if (currentState === STATES.HOME) {
        handleHomeStart();
    } else if (currentState === STATES.PLAYING) {
        player.jump();
    } else if (currentState === STATES.GAME_OVER) {
        // SPACE restarts
        currentState = STATES.PLAYING;
        resetGame();
    } else if (currentState === STATES.VICTORY) {
        currentState = STATES.PLAYING;
        resetGame();
    }
}

// Keyboard
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleActionInput(e);
    }
});

// Mouse tracking for hover on game over buttons
canvas.addEventListener('mousemove', (e) => {
    gameOverMouseX = e.clientX;
    gameOverMouseY = e.clientY;
});

// Canvas click
canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const mx = e.clientX;
    const my = e.clientY;

    if (currentState === STATES.GAME_OVER) {
        // Check button clicks
        if (gameOverRestartBtn && isPointInRect(mx, my, gameOverRestartBtn.x, gameOverRestartBtn.y, gameOverRestartBtn.w, gameOverRestartBtn.h)) {
            currentState = STATES.PLAYING;
            resetGame();
            return;
        }
        if (gameOverHomeBtn && isPointInRect(mx, my, gameOverHomeBtn.x, gameOverHomeBtn.y, gameOverHomeBtn.w, gameOverHomeBtn.h)) {
            stopMusic();
            goToHome();
            return;
        }
        // Click anywhere else = restart
        handleActionInput(e);
    } else {
        handleActionInput(e);
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mx = touch.clientX;
    const my = touch.clientY;
    gameOverMouseX = mx;
    gameOverMouseY = my;

    if (currentState === STATES.GAME_OVER) {
        if (gameOverRestartBtn && isPointInRect(mx, my, gameOverRestartBtn.x, gameOverRestartBtn.y, gameOverRestartBtn.w, gameOverRestartBtn.h)) {
            currentState = STATES.PLAYING;
            resetGame();
            return;
        }
        if (gameOverHomeBtn && isPointInRect(mx, my, gameOverHomeBtn.x, gameOverHomeBtn.y, gameOverHomeBtn.w, gameOverHomeBtn.h)) {
            stopMusic();
            goToHome();
            return;
        }
        handleActionInput(e);
    } else {
        handleActionInput(e);
    }
}, { passive: false });

// ═══════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════
initIntro();
requestAnimationFrame(gameLoop);
