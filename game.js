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
    // Mobile boost: slightly larger sprites on small screens
    const baseScale = Math.min(canvas.width / 800, canvas.height / 300) * 3;
    const isMobile = canvas.width < 768;
    DYNAMIC_SCALE = isMobile ? baseScale * 1.35 : baseScale;

    // Recalculate player size and ground snap position on resize
    try {
        if (typeof player !== 'undefined' && player && player.recalcSize) {
            player.recalcSize();
            if (player.isGrounded) {
                player.y = GROUND_Y - player.drawH;
            }
        }
    } catch (e) {
        // Safe swallow if player is not yet initialized during initial script execution
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

// Persistent Shop & Wallet
let walletAcorns = parseInt(localStorage.getItem('squirrelgame_wallet') || '0');
let unlockedHats = JSON.parse(localStorage.getItem('squirrelgame_unlocked_hats') || '["none"]');
let selectedHat = localStorage.getItem('squirrelgame_selected_hat') || 'none';
let shopOpen = false;
let shopBtn = { x: 0, y: 0, w: 0, h: 0 };
let shopCloseBtn = { x: 0, y: 0, w: 0, h: 0 };
const HATS_LIST = [
    { id: 'none', name: 'NO HAT', cost: 0 },
    { id: 'top_hat', name: 'TOP HAT', cost: 20 },
    { id: 'aviators', name: 'AVIATORS', cost: 50 },
    { id: 'crown', name: 'ROYAL CROWN', cost: 100 }
];

// Combo Multiplier
let comboCount = 0;
let comboMultiplier = 1;
let comboTimer = 0;

// Particle Systems
let jumpDustParticles = [];
let stars = [];
let fireflies = [];


const IMPROVEMENT_TIPS = [
    "TIP: Double jump over tall enemies!",
    "TIP: Collect acorns for bonus score!",
    "TIP: Speed increases over time — stay sharp!",
    "TIP: Watch for flying enemies at mid-height!",
    "TIP: Stage 2 starts at score 300 — get ready!",
    "TIP: Stage 3 at score 600 — maximum speed!",
    "TIP: Time your jumps early — don't wait!",
    "TIP: Acorns give +5 bonus — worth grabbing!",
    "TIP: The gator flies — jump UNDER or OVER it!",
    "TIP: Reach score 1000 for VICTORY!"
];
let currentTipIndex = 0;

// ═══════════════════════════════════════════════════
// ASSETS
// ═══════════════════════════════════════════════════
const assets = {
    bgLayer1: new Image(),
    bgLayer2: new Image(),
    bgLayer3: new Image(),
    player: new Image(),
    frog: new Image(),
    opossum: new Image(),
    bee: new Image(),
    acorn: new Image(),
    tree: new Image()
};

assets.bgLayer1.src = 'Assets/background/layer-1.png';
assets.bgLayer2.src = 'Assets/background/layer-2.png';
assets.bgLayer3.src = 'Assets/background/layer-3.png';
assets.bgLayer4 = undefined; // compatibility fallback if referenced
assets.player.src = 'Assets/player.png';
assets.frog.src = 'Assets/enemies/frog.png';
assets.opossum.src = 'Assets/enemies/opossum.png';
assets.bee.src = 'Assets/enemies/bee.png';
assets.acorn.src = 'Assets/acorn.png';
assets.tree.src = 'Assets/tree.png';

let assetsLoaded = 0;
const totalAssets = Object.values(assets).filter(img => img instanceof Image).length;
let isGameReady = false;

Object.values(assets).forEach(img => {
    if (!(img instanceof Image)) return;
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

function playMusic(volume) {
    initAudio();
    const music = getMusicAudio();
    if (music) {
        music.volume = volume || 0.35;
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
let shakeTimer = 0;
let shakeMagnitude = 0;
function playScreenShake(magnitude, duration = 12) {
    shakeTimer = duration;
    shakeMagnitude = magnitude;
}
let powerups = [];
let nextPowerupSpawnTime = 0;
let weatherParticles = [];
let lives = 3;
let livesLostFlashTimer = 0;

let victoryPhase = 0;         // 0=tree_enter 1=squirrel_run 2=squirrel_inside 3=celebration 4=finale
let victoryPhaseTimer = 0;
let victoryTreeX = 0;
let victorySquirrelX = 0;
let victorySquirrelY = 0;
let victoryParticles = [];
let victoryStars = [];
let victoryFireworks = [];

// Home screen squirrel animation state (8-phase tree story)
let homeSquirrelPhase = 'in_tree';
let homeSquirrelTimer = 0;
let homeSquirrelX = 0;
let homeSquirrelVelY = 0;
let homeSquirrelY = 0;       // dynamic Y (for jumps)
let homeSquirrelOnGround = true;
let homeSquirrelJumpsLeft = 2;
let homeAcorn1Collected = false;
let homeAcorn2Collected = false;
let homeAcorn3Collected = false;
let homeCollectBurst = [];
let homeTreeX = 0;           // set in goToHome

// ═══════════════════════════════════════════════════
// INTRO STATE
// ═══════════════════════════════════════════════════
let introStartTime = 0;
const INTRO_DURATION = 22.0;
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
    // Play music during intro at soft volume
    const music = getMusicAudio();
    if (music) {
        music.volume = 0.15;
        music.play().catch(() => {});
    }
}

// ═══════════════════════════════════════════════════
// HOME SCREEN STATE
// ═══════════════════════════════════════════════════
let homeParticles = [];
let gameLeaves = [];   // leaves during gameplay
let homeTime = 0;
let homeFadeIn = 0;
let homeTransitioning = false;
let homeTransitionAlpha = 0;

class LeafParticle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = -10;
        this.vx = 0;
        this.vy = 0.5 + Math.random() * 0.8;          // slower = more floaty
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.06; // some rotate clockwise, some counter
        this.alpha = 0.5 + Math.random() * 0.5;
        this.size = 2 + Math.random() * 5;            // more size variety (tiny to big)
        const colorRoll = Math.random();
        this.color = colorRoll < 0.35 ? '#f0a500'     // amber/gold
                   : colorRoll < 0.65 ? '#7ec850'     // green
                   : colorRoll < 0.82 ? '#e8570a'     // orange-red autumn
                   : '#c8e050';                        // yellow-green
        this.phaseOffset = Math.random() * Math.PI * 2;
    }
    update(t) {
        this.x += Math.sin(t * 1.5 + this.phaseOffset) * 0.8;  // wider sway
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

class RainDrop {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * -canvas.height;
        this.vy = 14 + Math.random() * 6;
        this.length = 12 + Math.random() * 10;
        this.alpha = 0.3 + Math.random() * 0.4;
    }
    update() { this.y += this.vy; }
    draw() {
        if (this.y > canvas.height) { this.y = Math.random() * -200; this.x = Math.random() * canvas.width; }
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.strokeStyle = '#a8d8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - 2, this.y + this.length);
        ctx.stroke();
        ctx.restore();
    }
}

class SnowFlake {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * -canvas.height;
        this.vy = 1.5 + Math.random() * 2;
        this.vx = (Math.random() - 0.5) * 1.2;
        this.size = 2 + Math.random() * 3;
        this.alpha = 0.5 + Math.random() * 0.5;
        this.phase = Math.random() * Math.PI * 2;
    }
    update() {
        this.y += this.vy;
        this.x += Math.sin(performance.now() / 800 + this.phase) * 0.6 + this.vx;
        if (this.y > canvas.height) { this.y = -10; this.x = Math.random() * canvas.width; }
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#e8f4ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
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
    hasShield: false,
    shieldTimer: 0,
    speedBoost: false,
    speedBoostTimer: 0,
    squashStretchX: 1,
    squashStretchY: 1,
    squashStretchTimer: 0,

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
        this.hasShield = false;
        this.shieldTimer = 0;
        this.speedBoost = false;
        this.speedBoostTimer = 0;
        this.squashStretchX = 1;
        this.squashStretchY = 1;
        this.squashStretchTimer = 0;
    },

    jump() {
        if (this.jumpsLeft <= 0 || currentState === STATES.DEATH_ANIMATION) return;
        const isSecond = (this.jumpsLeft === 1);
        this.velY = isSecond ? JUMP_VELOCITY * 0.85 : JUMP_VELOCITY;
        this.jumpsLeft--;

        // Stretch on jump
        this.squashStretchY = 1.25;
        this.squashStretchX = 0.8;
        this.squashStretchTimer = 12;

        // Double jump dust ring
        if (isSecond) {
            for (let i = 0; i < 8; i++) {
                jumpDustParticles.push(new JumpDustParticle(this.x + this.drawW * 0.45, this.y + this.drawH));
            }
        }

        this.isGrounded = false;
        playJumpSound(isSecond);
    },

    update(speed) {
        // Gravity
        this.velY += GRAVITY;
        this.y += this.velY;

        let hitGround = false;
        if (this.y + this.drawH >= GROUND_Y) {
            this.y = GROUND_Y - this.drawH;
            this.velY = 0;
            if (!this.isGrounded) {
                hitGround = true;
            }
            this.isGrounded = true;
            this.jumpsLeft = 2;
        }

        // Squash on landing
        if (hitGround) {
            this.squashStretchY = 0.75;
            this.squashStretchX = 1.25;
            this.squashStretchTimer = 15;
            playLandingDust(this.x + this.drawW * 0.45, GROUND_Y);
        }

        // Decay squash & stretch
        if (this.squashStretchTimer > 0) {
            this.squashStretchTimer--;
            this.squashStretchX += (1 - this.squashStretchX) * 0.15;
            this.squashStretchY += (1 - this.squashStretchY) * 0.15;
        } else {
            this.squashStretchX = 1;
            this.squashStretchY = 1;
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
        const drawBaseX = (overrideX !== undefined ? overrideX : this.x);
        const drawBaseY = (overrideY !== undefined ? overrideY : this.y);

        ctx.save();
        // Set pivot point at bottom center of feet for proper squash scaling
        const pivotX = drawBaseX + dw / 2;
        const pivotY = drawBaseY + dh;
        ctx.translate(pivotX, pivotY);
        ctx.scale(this.squashStretchX, this.squashStretchY);

        ctx.drawImage(assets.player, sx, 0, frameW, frameH, -dw / 2, -dh, dw, dh);
        ctx.restore();

        // Draw Selected Hat on player's head
        if (selectedHat !== 'none') {
            drawHat(ctx, drawBaseX, drawBaseY, state, this.animFrame, scaleMultiplier || 1);
        }
    }
};

// ═══════════════════════════════════════════════════
// UPGRADE HELPERS & DECORATIONS
// ═══════════════════════════════════════════════════
class JumpDustParticle {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y + (Math.random() - 0.5) * 5;
        this.vx = (Math.random() - 0.5) * 3;
        this.vy = -0.5 - Math.random() * 1.5;
        this.life = 15 + Math.random() * 10;
        this.maxLife = this.life;
        this.size = 2 + Math.random() * 4;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = 'rgba(230, 240, 255, 0.75)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function playLandingDust(x, y) {
    for (let i = 0; i < 8; i++) {
        jumpDustParticles.push(new JumpDustParticle(x, y));
    }
}

function drawHat(ctx, px, py, state, frame, scaleMultiplier) {
    const scale = DYNAMIC_SCALE * (scaleMultiplier || 1);
    const dw = 90 * (scale / 3);
    const dh = 58 * (scale / 3);

    let runBounce = 0;
    if (state === 'run') {
        runBounce = (frame === 1 || frame === 4) ? 2 : (frame === 2 || frame === 3) ? -1 : 0;
        runBounce *= (scale / 3);
    } else if (state === 'idle') {
        runBounce = Math.sin(performance.now() * 0.008) * 1.2 * (scale / 3);
    }

    // Head center position relative to player draw coordinates
    const hx = px + dw * 0.44;
    const hy = py + dh * 0.28 + runBounce;

    ctx.save();
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#000';

    if (selectedHat === 'top_hat') {
        const hatW = 24 * (scale / 3);
        const hatH = 20 * (scale / 3);
        const hX = hx - hatW / 2;
        const hY = hy - hatH;

        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(hX, hY, hatW, hatH);
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(hX, hY + hatH - 5 * (scale/3), hatW, 5 * (scale/3));
        
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(hX - 4 * (scale/3), hY + hatH - 2 * (scale/3), hatW + 8 * (scale/3), 3 * (scale/3));

    } else if (selectedHat === 'aviators') {
        const glassW = 20 * (scale / 3);
        const glassH = 6 * (scale / 3);
        const gX = hx + 1 * (scale / 3);
        const gY = hy + 4 * (scale / 3);

        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        
        ctx.fillRect(gX, gY, glassW, glassH);
        ctx.strokeRect(gX, gY, glassW, glassH);
        
        ctx.beginPath();
        ctx.moveTo(gX + glassW/2, gY);
        ctx.lineTo(gX + glassW/2, gY + glassH);
        ctx.stroke();

    } else if (selectedHat === 'crown') {
        const crownW = 24 * (scale / 3);
        const crownH = 14 * (scale / 3);
        const cX = hx - crownW / 2;
        const cY = hy - crownH;

        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(cX, cY + crownH);
        ctx.lineTo(cX, cY);
        ctx.lineTo(cX + crownW * 0.25, cY + crownH * 0.45);
        ctx.lineTo(cX + crownW * 0.5, cY);
        ctx.lineTo(cX + crownW * 0.75, cY + crownH * 0.45);
        ctx.lineTo(cX + crownW, cY);
        ctx.lineTo(cX + crownW, cY + crownH);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#e69900';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.arc(cX + crownW * 0.5, cY + crownH * 0.75, 2 * (scale/3), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#33ccff';
        ctx.beginPath();
        ctx.arc(cX + crownW * 0.25, cY + crownH * 0.75, 1.5 * (scale/3), 0, Math.PI * 2);
        ctx.arc(cX + crownW * 0.75, cY + crownH * 0.75, 1.5 * (scale/3), 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function getSkyColor(currentScore) {
    if (currentScore < 150) {
        const t = currentScore / 150;
        return lerpHexColor('#ffb085', '#87CEEB', t);
    } else if (currentScore < 300) {
        return '#87CEEB';
    } else if (currentScore < 600) {
        const t = (currentScore - 300) / 300;
        return lerpHexColor('#87CEEB', '#ff7e5f', t);
    } else if (currentScore < 900) {
        const t = (currentScore - 600) / 300;
        return lerpHexColor('#ff7e5f', '#0f0c1b', t);
    } else {
        return '#0c192c';
    }
}

function lerpHexColor(color1, color2, t) {
    const c1 = parseHex(color1);
    const c2 = parseHex(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
}

function parseHex(hex) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16)
    };
}

function drawTimeOfDayOverlay() {
    if (currentState !== STATES.PLAYING && currentState !== STATES.DEATH_ANIMATION) return;
    const w = canvas.width, h = canvas.height;
    
    if (score < 150) {
        const t = score / 150;
        ctx.fillStyle = `rgba(255, 120, 80, ${0.12 * (1 - t)})`;
        ctx.fillRect(0, 0, w, h);
    } else if (score >= 300 && score < 600) {
        const t = (score - 300) / 300;
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `rgba(120, 20, 100, ${0.25 * t})`);
        grad.addColorStop(1, `rgba(255, 80, 20, ${0.12 * t})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    } else if (score >= 600) {
        const t = Math.min(1, (score - 600) / 300);
        ctx.fillStyle = `rgba(10, 8, 25, ${0.52 * t})`;
        ctx.fillRect(0, 0, w, h);
        drawStarsAndFireflies(t);
    }
}

function drawStarsAndFireflies(intensity) {
    const w = canvas.width, h = canvas.height;
    if (stars.length === 0) {
        for (let i = 0; i < 40; i++) {
            stars.push({
                x: Math.random() * w,
                y: Math.random() * h * 0.45,
                size: 0.8 + Math.random() * 1.5,
                phase: Math.random() * Math.PI
            });
        }
    }
    if (fireflies.length === 0) {
        for (let i = 0; i < 15; i++) {
            fireflies.push({
                x: Math.random() * w,
                y: h * 0.35 + Math.random() * h * 0.45,
                size: 1.5 + Math.random() * 2,
                phase: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 0.5
            });
        }
    }

    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * intensity})`;
    for (const star of stars) {
        const alpha = 0.3 + Math.sin(performance.now() * 0.003 + star.phase) * 0.7;
        ctx.globalAlpha = Math.max(0, alpha * intensity);
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#ffffaa';
    for (const ff of fireflies) {
        ff.phase += 0.02;
        ff.x -= ff.speed;
        ff.y += Math.sin(ff.phase) * 0.25;
        if (ff.x < -20) ff.x = w + 20;

        const pulse = 0.4 + Math.sin(ff.phase) * 0.6;
        ctx.globalAlpha = pulse * intensity;
        ctx.fillStyle = '#fffa88';
        ctx.beginPath();
        ctx.arc(ff.x, ff.y, ff.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

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
            this.width = this.drawW * 0.55;   // used directly for AABB from this.x
            this.height = this.drawH * 0.80;  // full draw height for ground contact
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
            this.width = this.drawW * 0.60;
            this.height = this.drawH * 0.85;
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
        
        // this.y = GROUND_Y - this.drawH for ground enemies — draw directly
        const drawX = this.x;
        const drawY = this.y;
        
        ctx.drawImage(
            this.sheet,
            sx, 0, this.frameWidth, this.frameHeight,
            drawX, drawY, dw, dh
        );
        ctx.restore();
    }
}

// ═══════════════════════════════════════════════════
// GIANT BEE BOSS
// ═══════════════════════════════════════════════════
function playBossWarningSirens() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now + i * 0.4);
        osc.frequency.exponentialRampToValueAtTime(600, now + i * 0.4 + 0.35);
        
        gain.gain.setValueAtTime(0, now + i * 0.4);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.4 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.4 + 0.35);
        
        osc.start(now + i * 0.4);
        osc.stop(now + i * 0.4 + 0.35);
    }
}

class Pinecone {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 24 * (DYNAMIC_SCALE / 3);
        this.height = 24 * (DYNAMIC_SCALE / 3);
        this.vx = -4.5;
        this.vy = 0;
        this.bounceCount = 0;
    }
    update() {
        this.x += this.vx;
        this.vy += GRAVITY * 0.75;
        this.y += this.vy;
        
        if (this.y + this.height >= GROUND_Y) {
            this.y = GROUND_Y - this.height;
            this.vy = -6;
            this.bounceCount++;
        }
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#8b5a2b';
        ctx.fillStyle = '#6e473b';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

const boss = {
    active: false,
    x: -300,
    y: 100,
    width: 200,
    height: 213,
    hp: 3,
    maxHp: 3,
    state: 'enter',
    timer: 0,
    velY: 0,
    velX: 0,
    screechFlash: 0,
    pinecones: [],
    warningShown: 0,

    reset() {
        this.active = false;
        this.x = -300;
        this.y = 100;
        this.width = 200;
        this.height = 213;
        this.hp = 3;
        this.state = 'enter';
        this.timer = 0;
        this.pinecones = [];
        this.screechFlash = 0;
        this.warningShown = 0;
    },

    update() {
        if (!this.active) return;
        this.timer++;
        
        if (this.screechFlash > 0) this.screechFlash -= 0.05;

        // Boss State Machine
        if (this.state === 'enter') {
            this.x += (80 - this.x) * 0.03;
            this.y = 120 + Math.sin(this.timer * 0.05) * 30;
            if (Math.abs(this.x - 80) < 5) {
                this.state = 'hover';
                this.timer = 0;
            }
        } else if (this.state === 'hover') {
            this.x = 80 + Math.sin(this.timer * 0.03) * 15;
            this.y = 120 + Math.sin(this.timer * 0.05) * 30;

            if (this.timer % 150 === 0) {
                this.pinecones.push(new Pinecone(this.x + this.width, this.y + this.height * 0.5));
                playScreenShake(4);
            }
            if (this.timer === 240) {
                this.state = 'swoop';
                this.timer = 0;
                this.velX = 6;
                this.velY = 2;
            }
        } else if (this.state === 'swoop') {
            if (this.timer < 90) {
                this.x += this.velX;
                this.y += this.velY;
                if (this.y + this.height > GROUND_Y) {
                    this.y = GROUND_Y - this.height;
                    this.velY = -4;
                }
            } else {
                this.x += (80 - this.x) * 0.05;
                this.y += (120 - this.y) * 0.05;
                if (Math.abs(this.x - 80) < 10 && Math.abs(this.y - 120) < 10) {
                    this.state = 'hover';
                    this.timer = 0;
                }
            }
        } else if (this.state === 'retreat') {
            this.x -= 8;
            this.y -= 3;
            if (this.x < -300) {
                this.active = false;
            }
        }

        // Update bouncing pinecones
        for (let i = this.pinecones.length - 1; i >= 0; i--) {
            const pc = this.pinecones[i];
            pc.update();
            
            // Pinecone player hit detection
            if (checkAABB(player, pc)) {
                if (player.hasShield) {
                    player.hasShield = false;
                    this.pinecones.splice(i, 1);
                    scoreFloaters.push(new ScoreFloater(player.x, player.y, 'SHIELD BROKEN!', '#ff4060'));
                    playScreenShake(12);
                } else {
                    triggerDeathState();
                }
                continue;
            }
            if (pc.x < -50) {
                this.pinecones.splice(i, 1);
            }
        }
    },

    draw() {
        if (!this.active) return;
        const w = canvas.width, h = canvas.height;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        // Draw giant pixel-art bee sprite from existing bee asset
        if (assets.bee.complete && assets.bee.naturalWidth) {
            const imgW = assets.bee.naturalWidth;
            const imgH = assets.bee.naturalHeight;
            const frameW = imgW / 4;
            const frameH = imgH;
            
            const frameIndex = Math.floor(this.timer / 6) % 4; // fast wing flap
            const sx = frameIndex * frameW;

            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffe033'; // neon yellow aura

            ctx.save();
            if (this.state === 'swoop' && this.timer < 90) {
                // Flip horizontally so the bee faces RIGHT when swooping right
                ctx.translate(this.x + this.width, this.y);
                ctx.scale(-1, 1);
                ctx.drawImage(
                    assets.bee,
                    sx, 0, frameW, frameH,
                    0, 0, this.width, this.height
                );
            } else {
                // Face LEFT normally (towards player)
                ctx.drawImage(
                    assets.bee,
                    sx, 0, frameW, frameH,
                    this.x, this.y, this.width, this.height
                );
            }
            ctx.restore();
        } else {
            // Fallback rectangle
            ctx.fillStyle = '#f1c40f'; // bright yellow fallback
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

        // Boss Health Bar UI
        const barW = this.width * 0.8;
        const barH = 8;
        const barX = this.x + (this.width - barW) / 2;
        const barY = this.y - 15;
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#222';
        ctx.fillRect(barX, barY, barW, barH);
        
        const ratio = this.hp / this.maxHp;
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(barX, barY, barW * ratio, barH);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#fff';
        ctx.font = `${clampFont(8, 1, 10)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.fillText('GIANT BEE BOSS', this.x + this.width * 0.5, this.y - 25);

        ctx.restore();

        // Draw Bouncing Pinecones
        for (const pc of this.pinecones) {
            pc.draw();
        }

        // Screech flash decay rendering
        if (this.screechFlash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.screechFlash})`;
            ctx.fillRect(0, 0, w, h);
        }
    }
};

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

class PowerUp {
    constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.baseY = y;
        this.width = 24 * DYNAMIC_SCALE / 3;
        this.height = 24 * DYNAMIC_SCALE / 3;
        this.phaseOffset = Math.random() * Math.PI * 2;
    }

    update(speed) {
        this.x -= speed;
        this.y = this.baseY + Math.sin(performance.now() / 300 + this.phaseOffset) * 8;
    }

    draw() {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        
        if (this.type === 'shield') {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#7ec850';
            ctx.fillStyle = '#7ec850';
            ctx.strokeStyle = '#4a8a20';
            ctx.lineWidth = 2;
            
            const rx = this.width / 2;
            const ry = this.height / 2;
            const cx = this.x + rx;
            const cy = this.y + ry;
            
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.font = `${Math.max(10, DYNAMIC_SCALE * 4)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', cx, cy);
            
        } else if (this.type === 'boost') {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#f0a500';
            ctx.fillStyle = '#f0a500';
            
            const w = this.width;
            const h = this.height;
            const x = this.x;
            const y = this.y;
            
            ctx.beginPath();
            ctx.moveTo(x + w * 0.6, y);
            ctx.lineTo(x + w * 0.1, y + h * 0.55);
            ctx.lineTo(x + w * 0.5, y + h * 0.55);
            ctx.lineTo(x + w * 0.4, y + h);
            ctx.lineTo(x + w * 0.9, y + h * 0.45);
            ctx.lineTo(x + w * 0.5, y + h * 0.45);
            ctx.closePath();
            ctx.fill();
        }
        
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
        const scale = DYNAMIC_SCALE / 3;
        // Give each prop a consistent size based on type
        if (type === 'bush-small') {
            this.width = 48 * scale; this.height = 32 * scale;
        } else if (type === 'bush-large') {
            this.width = 72 * scale; this.height = 44 * scale;
        } else if (type === 'mushroom') {
            this.width = 20 * scale; this.height = 28 * scale;
        } else if (type === 'log') {
            this.width = 56 * scale; this.height = 22 * scale;
        } else if (type === 'flower') {
            this.width = 16 * scale; this.height = 24 * scale;
        } else {
            this.width = 40 * scale; this.height = 30 * scale;
        }
        this.y = GROUND_Y - this.height;
        this.seed = Math.random() * 1000; // for consistent random colours
    }

    update(speed) { this.x -= speed; }

    draw() {
        const s = DYNAMIC_SCALE / 3;
        const x = this.x, y = this.y;
        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (this.type === 'bush-small' || this.type === 'bush-large') {
            const w = this.width, h = this.height;
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.beginPath();
            ctx.ellipse(x + w/2, GROUND_Y + 3, w*0.4, 5, 0, 0, Math.PI*2);
            ctx.fill();
            // Dark base blob
            ctx.fillStyle = '#2a6e1a';
            ctx.beginPath();
            ctx.ellipse(x+w*0.35, y+h*0.65, w*0.32, h*0.38, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x+w*0.65, y+h*0.70, w*0.30, h*0.35, 0, 0, Math.PI*2);
            ctx.fill();
            // Mid green
            ctx.fillStyle = '#3d9e25';
            ctx.beginPath();
            ctx.ellipse(x+w*0.30, y+h*0.55, w*0.30, h*0.36, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x+w*0.70, y+h*0.58, w*0.28, h*0.33, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x+w*0.50, y+h*0.42, w*0.35, h*0.40, 0, 0, Math.PI*2);
            ctx.fill();
            // Highlight top
            ctx.fillStyle = '#5cc832';
            ctx.beginPath();
            ctx.ellipse(x+w*0.48, y+h*0.30, w*0.26, h*0.28, 0, 0, Math.PI*2);
            ctx.fill();
            // Tiny specular
            ctx.fillStyle = '#7dea45';
            ctx.beginPath();
            ctx.ellipse(x+w*0.44, y+h*0.22, w*0.12, h*0.13, -0.3, 0, Math.PI*2);
            ctx.fill();

        } else if (this.type === 'mushroom') {
            const w = this.width, h = this.height;
            // Stem
            ctx.fillStyle = '#e8dcc8';
            ctx.fillRect(x+w*0.3, y+h*0.55, w*0.4, h*0.45);
            ctx.fillStyle = '#c8b8a0';
            ctx.fillRect(x+w*0.3, y+h*0.55, w*0.1, h*0.45);
            // Cap shadow
            ctx.fillStyle = '#8B1a1a';
            ctx.beginPath();
            ctx.ellipse(x+w*0.52, y+h*0.52, w*0.52, h*0.48, 0, 0, Math.PI*2);
            ctx.fill();
            // Cap main
            ctx.fillStyle = '#cc2222';
            ctx.beginPath();
            ctx.ellipse(x+w*0.50, y+h*0.48, w*0.50, h*0.46, 0, 0, Math.PI*2);
            ctx.fill();
            // White spots
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(x+w*0.38, y+h*0.32, w*0.09, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(x+w*0.65, y+h*0.28, w*0.07, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(x+w*0.50, y+h*0.50, w*0.06, 0, Math.PI*2); ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255,100,100,0.4)';
            ctx.beginPath();
            ctx.ellipse(x+w*0.38, y+h*0.24, w*0.18, h*0.14, -0.4, 0, Math.PI*2);
            ctx.fill();

        } else if (this.type === 'log') {
            const w = this.width, h = this.height;
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(x+w/2, GROUND_Y+3, w*0.45, 5, 0, 0, Math.PI*2);
            ctx.fill();
            // Log body
            ctx.fillStyle = '#7a4010';
            ctx.fillRect(x, y+h*0.25, w, h*0.75);
            // Top highlight
            ctx.fillStyle = '#a05820';
            ctx.fillRect(x, y+h*0.25, w, h*0.22);
            // End circles
            ctx.fillStyle = '#5c2e08';
            ctx.beginPath(); ctx.ellipse(x+w*0.08, y+h*0.6, w*0.08, h*0.38, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#8B4513';
            ctx.beginPath(); ctx.ellipse(x+w*0.08, y+h*0.58, w*0.07, h*0.34, 0, 0, Math.PI*2); ctx.fill();
            // Bark lines
            ctx.strokeStyle = '#5c2e08';
            ctx.lineWidth = Math.max(1, s * 0.8);
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                ctx.moveTo(x + w*0.2*i, y+h*0.25);
                ctx.lineTo(x + w*0.2*i, y+h);
                ctx.stroke();
            }

        } else if (this.type === 'flower') {
            const w = this.width, h = this.height;
            // Stem
            ctx.strokeStyle = '#3a8a18';
            ctx.lineWidth = Math.max(1, w*0.15);
            ctx.beginPath();
            ctx.moveTo(x+w/2, y+h);
            ctx.bezierCurveTo(x+w*0.4, y+h*0.7, x+w*0.6, y+h*0.4, x+w/2, y+h*0.3);
            ctx.stroke();
            // Petals
            const petalColors = ['#ff6eb4','#ffcc00','#ff8c00','#cc44ff'];
            const pc = petalColors[Math.floor(this.seed * 4) % 4];
            ctx.fillStyle = pc;
            for (let i = 0; i < 5; i++) {
                const a = (Math.PI*2/5)*i;
                ctx.beginPath();
                ctx.ellipse(x+w/2+Math.cos(a)*w*0.28, y+h*0.28+Math.sin(a)*h*0.28,
                    w*0.18, h*0.14, a, 0, Math.PI*2);
                ctx.fill();
            }
            // Center
            ctx.fillStyle = '#ffee55';
            ctx.beginPath(); ctx.arc(x+w/2, y+h*0.28, w*0.16, 0, Math.PI*2); ctx.fill();
        }

        ctx.restore();
    }
}

// ═══════════════════════════════════════════════════
// SCORE FLOATER
// ═══════════════════════════════════════════════════
class ScoreFloater {
    constructor(x, y, text, color = '#f0a500') {
        this.x = x; this.y = y; this.text = text;
        this.color = color;
        this.life = 60; this.maxLife = 60;
    }
    update() { this.y -= 1; this.life--; }
    draw() {
        const alpha = this.life / this.maxLife;
        const fontSize = Math.max(10, DYNAMIC_SCALE * 4);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `${fontSize}px "Press Start 2P"`;
        ctx.fillStyle = this.color;
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
            // Increment persistent wallet
            walletAcorns += 1;
            localStorage.setItem('squirrelgame_wallet', walletAcorns.toString());

            // Combo Multiplier
            comboCount++;
            comboTimer = 120;
            comboMultiplier = Math.min(5, Math.floor(comboCount / 3) + 1);

            const addedScore = 5 * comboMultiplier;
            score += addedScore;

            let floaterText = `+${addedScore}`;
            let floaterColor = '#fff';
            if (comboMultiplier > 1) {
                floaterText = `+${addedScore} (${comboMultiplier}x!)`;
                floaterColor = comboMultiplier === 5 ? '#ff3333' : comboMultiplier >= 3 ? '#ffcc00' : '#7ec850';
            }
            scoreFloaters.push(new ScoreFloater(acorns[i].x, acorns[i].y, floaterText, floaterColor));

            acorns.splice(i, 1);
            playCollectSound();
            flashTimer = 8;
        }
    }
    for (let i = powerups.length - 1; i >= 0; i--) {
        if (checkAABB(player, powerups[i])) {
            const p = powerups[i];
            if (p.type === 'shield') {
                player.hasShield = true;
                player.shieldTimer = 300;
                scoreFloaters.push(new ScoreFloater(player.x + player.width / 2, player.y, 'SHIELD!', '#7ec850'));
            } else if (p.type === 'boost') {
                if (!player.speedBoost) {
                    gameSpeed += 2.5;
                }
                player.speedBoost = true;
                player.speedBoostTimer = 240;
                scoreFloaters.push(new ScoreFloater(player.x + player.width / 2, player.y, 'FAST!', '#f0a500'));
            }
            playCollectSound();
            powerups.splice(i, 1);
        }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (checkAABB(player, enemies[i])) {
            // Reset combo on hit
            comboCount = 0;
            comboMultiplier = 1;
            comboTimer = 0;

            if (player.hasShield) {
                player.hasShield = false;
                player.shieldTimer = 0;
                enemies.splice(i, 1);
            } else {
                triggerDeathState();
                break;
            }
        }
    }

    // Boss Collision Check
    if (boss.active && (boss.state === 'hover' || boss.state === 'swoop')) {
        if (checkAABB(player, boss)) {
            // Check if landing on boss's head
            const isFallingOnTop = (player.velY > 0 && player.y + player.height <= boss.y + boss.height * 0.45);
            if (isFallingOnTop) {
                boss.hp--;
                playScreenShake(15);
                player.velY = -8.5; // high bounce bounce!
                player.squashStretchY = 1.35;
                player.squashStretchX = 0.7;
                player.squashStretchTimer = 15;
                
                scoreFloaters.push(new ScoreFloater(boss.x + boss.width / 2, boss.y, '-1 HP!', '#ff3333'));
                playJumpSound(true);
                
                if (boss.hp <= 0) {
                    boss.state = 'retreat';
                    boss.timer = 0;
                    score += 100;
                    scoreFloaters.push(new ScoreFloater(boss.x + boss.width / 2, boss.y - 30, '+100 VICTORY!', '#ffcc00'));
                }
            } else {
                // Side body collision
                comboCount = 0;
                comboMultiplier = 1;
                comboTimer = 0;
                
                if (player.hasShield) {
                    player.hasShield = false;
                    player.shieldTimer = 0;
                    scoreFloaters.push(new ScoreFloater(player.x, player.y, 'SHIELD BROKEN!', '#ff4060'));
                    playScreenShake(12);
                    player.velY = -4;
                } else {
                    triggerDeathState();
                }
            }
        }
    }
}

function triggerDeathState() {
    currentState = STATES.DEATH_ANIMATION;
    player.animState = 'death';
    player.animFrame = 0;
    player.animTimer = 0;
    player.deathTimer = 0;
    lives--;
    livesLostFlashTimer = 40;
    pauseMusic();
    playDeathSound();
    currentTipIndex = Math.floor(Math.random() * IMPROVEMENT_TIPS.length);
    shakeTimer = 18;
    shakeMagnitude = 10;
    if (lives > 0) {
        scoreFloaters.push(new ScoreFloater(player.x + player.width / 2, player.y - 20, `♥ ${lives} LEFT`, '#ff4060'));
    }
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
    powerups = [];
    weatherParticles = [];
    propDecorations = [];
    scoreFloaters = [];
    gameLeaves = [];
    shakeTimer = 0;
    shakeMagnitude = 0;
    lives = 3;
    livesLostFlashTimer = 0;

    // Reset Upgrades States
    shopOpen = false;
    comboCount = 0;
    comboMultiplier = 1;
    comboTimer = 0;
    jumpDustParticles = [];
    boss.reset();


    propDecorations.push(new PropDecoration('bush-small', canvas.width * 0.35));
    propDecorations.push(new PropDecoration('log', canvas.width * 0.7));

    player.reset();

    const now = performance.now();
    nextEnemySpawnTime = now + 1500;
    nextAcornSpawnTime = now + 2000;
    nextPropSpawnTime = now + 1000;
    nextPowerupSpawnTime = now + 8000;

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
        const types = ['bush-small', 'bush-large', 'mushroom', 'log', 'flower', 'bush-small'];
        propDecorations.push(new PropDecoration(types[Math.floor(Math.random() * types.length)], canvas.width + 200));
    }
    if (now >= nextPowerupSpawnTime) {
        nextPowerupSpawnTime = now + 8000 + Math.random() * 6000;
        const type = Math.random() < 0.5 ? 'shield' : 'boost';
        const powerupY = GROUND_Y * 0.55 + Math.random() * GROUND_Y * 0.15;
        powerups.push(new PowerUp(type, canvas.width + 50, powerupY));
    }
}

// ═══════════════════════════════════════════════════
// DRAWING HELPERS
// ═══════════════════════════════════════════════════
function drawBackground(speedMultiplier) {
    ctx.imageSmoothingEnabled = false;
    const w = canvas.width, h = canvas.height;

    // Sky fallback
    if (currentState === STATES.PLAYING || currentState === STATES.DEATH_ANIMATION || currentState === STATES.GAME_OVER || currentState === STATES.VICTORY) {
        ctx.fillStyle = getSkyColor(score);
    } else {
        ctx.fillStyle = '#87CEEB';
    }
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
    const tileSize = Math.round(16 * (DYNAMIC_SCALE / 3));
    const numTiles = Math.ceil(canvas.width / tileSize) + 2;

    for (let i = 0; i < numTiles; i++) {
        const dx = Math.floor(groundScrollX + i * tileSize);

        // ── Surface tile (top row) ──
        // Main brown fill
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(dx, GROUND_Y, tileSize, tileSize);

        // Lighter top edge highlight
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(dx, GROUND_Y, tileSize, Math.max(2, tileSize * 0.15));

        // Dark left border
        ctx.fillStyle = '#5C2A0A';
        ctx.fillRect(dx, GROUND_Y, Math.max(1, tileSize * 0.06), tileSize);

        // Circle emblem in center of tile
        const cx = dx + tileSize / 2;
        const cy = GROUND_Y + tileSize / 2;
        const r = tileSize * 0.28;
        ctx.fillStyle = '#6B3410';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5C2A0A';
        ctx.lineWidth = Math.max(1, tileSize * 0.06);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // ── Fill tile (second row) ──
        ctx.fillStyle = '#7A3B10';
        ctx.fillRect(dx, GROUND_Y + tileSize, tileSize, tileSize);
        // Dark left border on fill tiles
        ctx.fillStyle = '#4A2008';
        ctx.fillRect(dx, GROUND_Y + tileSize, Math.max(1, tileSize * 0.06), tileSize);
        // Horizontal stripe
        ctx.fillStyle = '#6B3410';
        ctx.fillRect(dx, GROUND_Y + tileSize + Math.floor(tileSize * 0.4),
                     tileSize, Math.max(1, Math.floor(tileSize * 0.18)));

        // ── Deep fill (remaining screen height) ──
        if (GROUND_Y + tileSize * 2 < canvas.height) {
            ctx.fillStyle = '#5C2A0A';
            ctx.fillRect(dx, GROUND_Y + tileSize * 2,
                         tileSize, canvas.height - GROUND_Y - tileSize * 2);
        }
    }

    // Single-pixel tile separator lines
    ctx.strokeStyle = '#4A2008';
    ctx.lineWidth = 1;
    for (let i = 0; i < numTiles; i++) {
        const dx = Math.floor(groundScrollX + i * tileSize);
        ctx.beginPath();
        ctx.moveTo(dx, GROUND_Y);
        ctx.lineTo(dx, canvas.height);
        ctx.stroke();
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

    // Hearts (lives) display
    const heartSize = Math.max(12, fontSize * 1.2);
    const heartStartX = 20;
    const heartY = 16;
    for (let i = 0; i < 3; i++) {
        const hx = heartStartX + i * (heartSize + 6);
        ctx.save();
        if (i < lives) {
            // Filled heart with pulse when recently lost a life
            const pulse = livesLostFlashTimer > 0 ? 1 + Math.sin(livesLostFlashTimer * 0.5) * 0.15 : 1;
            ctx.fillStyle = '#ff4060';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ff4060';
            drawHeart(hx, heartY, heartSize * pulse);
            ctx.fill();
        } else {
            // Empty heart outline
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1.5;
            drawHeart(hx, heartY, heartSize);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Wallet Acorns display below hearts
    ctx.save();
    ctx.font = `${fontSize * 0.9}px "Press Start 2P"`;
    ctx.fillStyle = '#ffcc00';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#ffcc00';
    ctx.fillText(`🌰 ${walletAcorns}`, heartStartX, heartY + heartSize + 10);
    ctx.restore();

    // Combo Multiplier display below Score
    if (comboMultiplier > 1 && comboTimer > 0) {
        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        
        const comboColor = comboMultiplier === 5 ? '#ff3333' : comboMultiplier >= 3 ? '#ffcc00' : '#7ec850';
        ctx.fillStyle = comboColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = comboColor;
        
        const pulse = 1 + Math.sin(performance.now() * 0.015) * 0.08;
        const fontSz = Math.max(9, fontSize * 1.1 * pulse);
        ctx.font = `${fontSz}px "Press Start 2P"`;
        
        ctx.fillText(`${comboMultiplier}x COMBO!`, rx, ry + fontSize * 2 + 16);
        ctx.restore();
    }

    ctx.restore();
}

// Helper: draw a heart path
function drawHeart(x, y, size) {
    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(x + s, y + s * 0.4);
    ctx.bezierCurveTo(x + s, y, x + s * 2, y, x + s * 2, y + s * 0.4);
    ctx.bezierCurveTo(x + s * 2, y + s, x + s, y + s * 1.5, x + s, y + s * 1.8);
    ctx.bezierCurveTo(x + s, y + s * 1.5, x, y + s, x, y + s * 0.4);
    ctx.bezierCurveTo(x, y, x + s, y, x + s, y + s * 0.4);
    ctx.closePath();
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

        // Trigger Boss Fight at score 800
        if (score >= 800 && !boss.active && boss.hp > 0 && boss.warningShown < 1) {
            boss.active = true;
            boss.reset();
            boss.active = true;
            boss.warningShown = 1;
            enemies = [];
            playBossWarningSirens();
            playScreenShake(20);
        }

        // Update Boss
        if (boss.active) {
            boss.update();
        }

        // Update combo timer
        if (comboTimer > 0) {
            comboTimer--;
        } else {
            comboCount = 0;
            comboMultiplier = 1;
        }

        // Update jump dust particles
        for (let i = jumpDustParticles.length - 1; i >= 0; i--) {
            jumpDustParticles[i].update();
            if (jumpDustParticles[i].life <= 0) {
                jumpDustParticles.splice(i, 1);
            }
        }

        bgX1 -= (gameSpeed * 0.2);
        if (bgX1 <= -canvas.width) bgX1 += canvas.width;
        bgX2 -= (gameSpeed * 0.5);
        if (bgX2 <= -canvas.width) bgX2 += canvas.width;
        bgX3 -= gameSpeed;
        if (bgX3 <= -canvas.width) bgX3 += canvas.width;

        const tileSize = 16 * (DYNAMIC_SCALE / 3);
        groundScrollX -= gameSpeed;
        if (groundScrollX <= -tileSize) groundScrollX += tileSize;

        if (!boss.active) {
            handleSpawns(now);
        }
        // Spawn gameplay leaves — dense at start, then occasional
        const gameLeafRate = frameCount < 180 ? 8 : 35;  // fast first 3s, then sparse
        if (frameCount % gameLeafRate === 0) {
            const leaf = new LeafParticle();
            leaf.vy = 0.6 + Math.random() * 0.5;          // slightly slower than home
            leaf.size = 2 + Math.random() * 4;
            gameLeaves.push(leaf);
        }
        
        // Stage 2: rain
        if (currentStage === 2) {
            if (weatherParticles.length === 0 || weatherParticles[0] instanceof SnowFlake) weatherParticles = [];
            if (weatherParticles.length < 120) weatherParticles.push(new RainDrop());
            for (const r of weatherParticles) r.update();
        }
        // Stage 3: snow
        if (currentStage === 3) {
            if (weatherParticles.length === 0 || weatherParticles[0] instanceof RainDrop) weatherParticles = [];
            if (weatherParticles.length < 80) weatherParticles.push(new SnowFlake());
            for (const s of weatherParticles) s.update();
        }

        // Also spawn burst at game start (frameCount === 1)
        if (frameCount === 1) {
            for (let i = 0; i < 25; i++) {
                const leaf = new LeafParticle();
                leaf.y = Math.random() * GROUND_Y * 0.7;  // pre-scattered heights
                leaf.vy = 0.4 + Math.random() * 0.6;
                gameLeaves.push(leaf);
            }
        }
        // Update and cull game leaves
        for (let i = gameLeaves.length - 1; i >= 0; i--) {
            gameLeaves[i].update(frameCount / 60);
            if (gameLeaves[i].alpha <= 0) gameLeaves.splice(i, 1);
        }
        if (gameLeaves.length > 80) gameLeaves.splice(0, gameLeaves.length - 80);
        player.update(gameSpeed);

        // Powerup timers decrement
        if (player.hasShield) {
            if (player.shieldTimer > 0) {
                player.shieldTimer--;
                if (player.shieldTimer === 0) {
                    player.hasShield = false;
                }
            }
        }
        if (player.speedBoost) {
            if (player.speedBoostTimer > 0) {
                player.speedBoostTimer--;
                if (player.speedBoostTimer === 0) {
                    player.speedBoost = false;
                    gameSpeed -= 2.5;
                }
            }
        }

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
        for (let i = powerups.length - 1; i >= 0; i--) {
            powerups[i].update(gameSpeed);
            if (powerups[i].x < -100) powerups.splice(i, 1);
        }
        for (let i = scoreFloaters.length - 1; i >= 0; i--) {
            scoreFloaters[i].update();
            if (scoreFloaters[i].life <= 0) scoreFloaters.splice(i, 1);
        }

        checkCollisions();

        // Stage transitions
        if (score >= WINNING_SCORE) {
            currentState = STATES.VICTORY;
            victoryPhase = 0;
            victoryPhaseTimer = 0;
            victoryTreeX = canvas.width + 300;
            victorySquirrelX = player.x;
            victorySquirrelY = GROUND_Y - player.drawH;
            victoryParticles = [];
            victoryStars = [];
            victoryFireworks = [];
            // Pre-spawn victory stars
            for (let i = 0; i < 60; i++) {
                victoryStars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height * 0.6,
                    size: 1 + Math.random() * 3,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.02 + Math.random() * 0.04
                });
            }
            gameOverTime = performance.now();
            pauseMusic();
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('squirrelgame_hi', highScore.toString());
            }
        } else if (score >= 600 && currentStage < 3) {
            currentStage = 3;
            stageBannerTimer = 180;
            stageBannerText = "FINAL STAGE: WINTER RUN";
            gameSpeed += 0.8;
            playCollectSound();
        } else if (score >= 300 && currentStage < 2) {
            currentStage = 2;
            stageBannerTimer = 180;
            stageBannerText = "STAGE 2: MIDNIGHT RAIN";
            gameSpeed += 0.5;
            playCollectSound();
        }

        if (stageBannerTimer > 0) stageBannerTimer--;
        if (flashTimer > 0) flashTimer--;

    } else if (currentState === STATES.DEATH_ANIMATION) {
        player.update(0);
        // Update and cull game leaves during death animation
        for (let i = gameLeaves.length - 1; i >= 0; i--) {
            gameLeaves[i].update(frameCount / 60);
            if (gameLeaves[i].alpha <= 0) gameLeaves.splice(i, 1);
        }
        for (const wp of weatherParticles) wp.update();
        player.deathTimer++;
        // Update score floaters during death
        for (let i = scoreFloaters.length - 1; i >= 0; i--) {
            scoreFloaters[i].update();
            if (scoreFloaters[i].life <= 0) scoreFloaters.splice(i, 1);
        }
        if (livesLostFlashTimer > 0) livesLostFlashTimer--;
        if (player.deathTimer >= 90) {
            if (lives > 0) {
                // Auto-continue: reset player position, clear nearby enemies, resume
                currentState = STATES.PLAYING;
                player.y = GROUND_Y - player.drawH;
                player.velY = 0;
                player.isGrounded = true;
                player.jumpsLeft = 2;
                player.animState = 'run';
                player.animFrame = 0;
                player.animTimer = 0;
                player.deathTimer = 0;
                player.hasShield = true;
                player.shieldTimer = 180; // 3 seconds of invincibility after revive
                // Clear enemies near the player so they don't instantly die again
                enemies = enemies.filter(e => e.x > player.x + canvas.width * 0.4);
                playMusic();
            } else {
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
        // Spawn 3 leaves every 12 frames for a dense cinematic rainfall
        if (frameCount % 12 === 0) {
            for (let i = 0; i < 3; i++) {
                homeParticles.push(new LeafParticle());
            }
        }
        // Cap particle count to avoid performance issues
        if (homeParticles.length > 120) {
            homeParticles.splice(0, homeParticles.length - 120);
        }
        for (let i = homeParticles.length - 1; i >= 0; i--) {
            homeParticles[i].update(homeTime);
            if (homeParticles[i].alpha <= 0) homeParticles.splice(i, 1);
        }

        // ── 8-phase squirrel-in-tree story animation ──
        homeSquirrelTimer++;
        const HGRAV = 0.45;
        const homeGroundY = GROUND_Y - player.drawH;
        const nut1X = canvas.width * 0.40;
        const nut2X = canvas.width * 0.58;
        const nut3X = canvas.width * 0.72;
        const nut1Y = homeGroundY;                          // ground level
        const nut2Y = GROUND_Y - player.drawH * 1.8;       // mid-air
        const nut3Y = GROUND_Y - player.drawH * 3.0;       // high in air

        // Apply gravity when not on ground
        if (!homeSquirrelOnGround) {
            homeSquirrelVelY += HGRAV;
            homeSquirrelY += homeSquirrelVelY;
            if (homeSquirrelY >= homeGroundY) {
                homeSquirrelY = homeGroundY;
                homeSquirrelVelY = 0;
                homeSquirrelOnGround = true;
            }
        }

        function homeCollectBurstAt(bx, by) {
            playCollectSound();
            for (let i = 0; i < 6; i++) {
                homeCollectBurst.push({
                    x: bx, y: by,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -2 - Math.random() * 3,
                    life: 30,
                    size: 3 + Math.random() * 3,
                    color: Math.random() < 0.5 ? '#f0a500' : '#7ec850'
                });
            }
        }

        if (homeSquirrelPhase === 'in_tree') {
            // Hidden inside tree — not drawn
            player.animState = 'idle';
            if (homeSquirrelTimer > 80) {
                homeSquirrelPhase = 'exit_tree';
                homeSquirrelTimer = 0;
                homeSquirrelX = homeTreeX + player.drawW * 0.3;
                homeSquirrelY = homeGroundY;
                homeSquirrelOnGround = true;
                homeAcorn1Collected = false;
                homeAcorn2Collected = false;
                homeAcorn3Collected = false;
            }
        } else if (homeSquirrelPhase === 'exit_tree') {
            player.animState = 'run';
            homeSquirrelX += 2.0;
            if (homeSquirrelX >= homeTreeX + player.drawW * 1.2) {
                homeSquirrelPhase = 'run_to_nut1';
                homeSquirrelTimer = 0;
            }
        } else if (homeSquirrelPhase === 'run_to_nut1') {
            player.animState = 'run';
            homeSquirrelX += 2.0;
            if (homeSquirrelX >= nut1X) {
                homeSquirrelX = nut1X;
                homeSquirrelPhase = 'collect_nut1';
                homeSquirrelTimer = 0;
                homeAcorn1Collected = true;
                homeCollectBurstAt(homeSquirrelX + player.drawW / 2, homeGroundY);
            }
        } else if (homeSquirrelPhase === 'collect_nut1') {
            player.animState = 'idle';
            if (homeSquirrelTimer > 30) {
                homeSquirrelPhase = 'jump_to_nut2';
                homeSquirrelTimer = 0;
                homeSquirrelJumpsLeft = 2;
            }
        } else if (homeSquirrelPhase === 'jump_to_nut2') {
            player.animState = homeSquirrelOnGround ? 'run' : (homeSquirrelVelY < 0 ? 'jump' : 'fall');
            homeSquirrelX += 1.8;
            // Single jump when near nut2
            if (homeSquirrelX >= nut2X - player.drawW * 2 && homeSquirrelOnGround && homeSquirrelJumpsLeft === 2) {
                homeSquirrelVelY = -10;
                homeSquirrelOnGround = false;
                homeSquirrelJumpsLeft--;
                playJumpSound(false);
            }
            // Collect when close enough vertically
            if (!homeAcorn2Collected && homeSquirrelX >= nut2X - player.drawW * 0.5 && homeSquirrelY <= nut2Y + player.drawH * 0.5) {
                homeAcorn2Collected = true;
                homeCollectBurstAt(homeSquirrelX + player.drawW / 2, homeSquirrelY);
            }
            if (homeSquirrelX >= nut2X && homeSquirrelOnGround) {
                homeSquirrelPhase = 'jump2_to_nut3';
                homeSquirrelTimer = 0;
                homeSquirrelJumpsLeft = 2;
            }
        } else if (homeSquirrelPhase === 'jump2_to_nut3') {
            player.animState = homeSquirrelOnGround ? 'run' : (homeSquirrelVelY < 0 ? 'jump' : 'fall');
            homeSquirrelX += 1.8;
            // First jump
            if (homeSquirrelX >= nut3X - player.drawW * 3 && homeSquirrelOnGround && homeSquirrelJumpsLeft === 2) {
                homeSquirrelVelY = -10;
                homeSquirrelOnGround = false;
                homeSquirrelJumpsLeft--;
                playJumpSound(false);
            }
            // Double jump (mid-air)
            if (homeSquirrelJumpsLeft === 1 && !homeSquirrelOnGround && homeSquirrelVelY > -2) {
                homeSquirrelVelY = -9;
                homeSquirrelJumpsLeft--;
                playJumpSound(true);
                // Dust ring
                for (let i = 0; i < 8; i++) {
                    jumpDustParticles.push(new JumpDustParticle(homeSquirrelX + player.drawW * 0.45, homeSquirrelY + player.drawH));
                }
            }
            // Collect when close enough vertically
            if (!homeAcorn3Collected && homeSquirrelX >= nut3X - player.drawW * 0.5 && homeSquirrelY <= nut3Y + player.drawH * 0.5) {
                homeAcorn3Collected = true;
                homeCollectBurstAt(homeSquirrelX + player.drawW / 2, homeSquirrelY);
            }
            if (homeSquirrelX >= nut3X && homeSquirrelOnGround) {
                homeSquirrelPhase = 'return_tree';
                homeSquirrelTimer = 0;
            }
        } else if (homeSquirrelPhase === 'return_tree') {
            player.animState = 'run';
            homeSquirrelX -= 2.5;
            if (homeSquirrelX <= homeTreeX + player.drawW * 0.3) {
                homeSquirrelPhase = 'in_tree';
                homeSquirrelTimer = 0;
            }
        }

        // Update burst particles
        for (let i = homeCollectBurst.length - 1; i >= 0; i--) {
            homeCollectBurst[i].x += homeCollectBurst[i].vx;
            homeCollectBurst[i].y += homeCollectBurst[i].vy;
            homeCollectBurst[i].vy += 0.15;
            homeCollectBurst[i].life--;
            if (homeCollectBurst[i].life <= 0) homeCollectBurst.splice(i, 1);
        }

        // Update jump dust particles on home screen
        for (let i = jumpDustParticles.length - 1; i >= 0; i--) {
            jumpDustParticles[i].update();
            if (jumpDustParticles[i].life <= 0) jumpDustParticles.splice(i, 1);
        }

        player.animTimer++;
        if (player.animState === 'run') {
            if (player.animTimer >= 6) {
                player.animFrame = (player.animFrame + 1) % 6;
                player.animTimer = 0;
            }
        } else if (player.animState === 'jump' || player.animState === 'fall') {
            // Static frame for jump/fall
        } else {
            if (player.animTimer >= 10) {
                player.animFrame = (player.animFrame + 1) % 4;
                player.animTimer = 0;
            }
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
        if (elapsed >= 6.5 && elapsed < 11.5) {
            const sceneT = (elapsed - 6.5) / 5.0;
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
    } else if (currentState === STATES.VICTORY) {
        victoryPhaseTimer++;
        const treeScale = DYNAMIC_SCALE / 3;
        const treeDrawW = assets.tree ? 160 * treeScale : 120 * treeScale;
        const treeFinalX = canvas.width * 0.68;
        
        if (victoryPhase === 0) {
            // Phase 0: Tree slides in fast from right (0-60 frames)
            const t = Math.min(1, victoryPhaseTimer / 60);
            const ease = 1 - Math.pow(1 - t, 3);
            victoryTreeX = canvas.width + treeDrawW + (treeFinalX - canvas.width - treeDrawW) * ease;
            if (victoryPhaseTimer >= 60) { victoryPhase = 1; victoryPhaseTimer = 0; }
            
        } else if (victoryPhase === 1) {
            // Phase 1: Squirrel runs right toward tree hollow (0-90 frames)
            victoryTreeX = treeFinalX; // tree is stopped
            const targetX = treeFinalX + treeDrawW * 0.18;
            victorySquirrelX += (targetX - victorySquirrelX) * 0.045;
            player.animState = 'run';
            player.animTimer++;
            if (player.animTimer >= 6) { player.animFrame = (player.animFrame + 1) % 6; player.animTimer = 0; }
            if (victoryPhaseTimer >= 90) { victoryPhase = 2; victoryPhaseTimer = 0; }
            
        } else if (victoryPhase === 2) {
            // Phase 2: Squirrel shrinks into hollow (0-40 frames)
            victoryTreeX = treeFinalX;
            if (victoryPhaseTimer >= 40) { victoryPhase = 3; victoryPhaseTimer = 0; }
            
        } else if (victoryPhase === 3) {
            // Phase 3: Celebration — fireworks + particles (0-300 frames)
            victoryTreeX = treeFinalX;
            // Spawn fireworks
            if (victoryPhaseTimer % 25 === 0) {
                victoryFireworks.push({
                    x: canvas.width * (0.2 + Math.random() * 0.6),
                    y: canvas.height * (0.1 + Math.random() * 0.4),
                    particles: Array.from({length: 20}, () => ({
                        vx: (Math.random()-0.5)*8,
                        vy: (Math.random()-0.5)*8,
                        life: 40 + Math.random()*30,
                        maxLife: 70,
                        color: ['#ffd700','#ff4444','#44ff88','#44aaff','#ff44ff','#ffaa00'][Math.floor(Math.random()*6)],
                        size: 2 + Math.random()*3
                    }))
                });
            }
            // Update firework particles
            for (let fw of victoryFireworks) {
                for (let p of fw.particles) {
                    p.x = (p.x||fw.x) + p.vx;
                    p.y = (p.y||fw.y) + p.vy;
                    p.vy += 0.15;
                    p.life--;
                    p.x = p.x; p.y = p.y; // ensure initialized
                }
                fw.particles = fw.particles.filter(p => p.life > 0);
            }
            // Fix: initialize particle positions on first frame
            for (let fw of victoryFireworks) {
                for (let p of fw.particles) {
                    if (!p.startX) { p.startX = fw.x; p.startY = fw.y; p.x = fw.x; p.y = fw.y; }
                }
            }
            if (victoryPhaseTimer >= 300) { victoryPhase = 4; victoryPhaseTimer = 0; }
            
        } else if (victoryPhase === 4) {
            // Phase 4: Score/finale screen
            victoryTreeX = treeFinalX;
        }
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

    let shakeX = 0, shakeY = 0;
    if (shakeTimer > 0) {
        shakeTimer--;
        shakeMagnitude *= 0.85;
        shakeX = (Math.random() - 0.5) * shakeMagnitude * 2;
        shakeY = (Math.random() - 0.5) * shakeMagnitude * 2;
        ctx.save();
        ctx.translate(shakeX, shakeY);
    }

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
        drawVictory();
    }

    if (shakeX !== 0 || shakeY !== 0) ctx.restore();
}

function drawIntro() {
    const elapsed = performance.now() / 1000 - introStartTime;
    const w = canvas.width, h = canvas.height;

    // SCENE 1: 0.0 – 3.5s — Sun rising + text
    if (elapsed < 5.0) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        const fadeIn = Math.min(1, elapsed / 1.2);
        ctx.globalAlpha = fadeIn;

        // Draw pixel sun
        const sunY = h * 0.7 - (elapsed / 2.0) * h * 0.3;
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
        if (elapsed > 0.5) {
            const textAlpha = Math.min(1, (elapsed - 0.5) / 0.8);
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
    } else if (elapsed < 5.0) {
        // handled by overlap

    // SCENE 2: 3.5 – 6.5s — Fast parallax scroll
    } else if (elapsed < 9.0) {
        const sceneAlpha = elapsed < 5.3 ? (elapsed - 5.0) / 0.5 : (elapsed > 8.5 ? Math.max(0, 1 - (elapsed - 8.5) / 0.5) : 1);
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

    // SCENE 3: 6.5 – 10.5s — Squirrel runs in
    } else if (elapsed < 14.5) {
        const sceneAlpha = elapsed < 9.4 ? (elapsed - 9.0) / 0.4 : 1;
        ctx.globalAlpha = Math.min(1, sceneAlpha);

        drawBackground(1);
        drawGroundTiles();

        // Draw player running in
        player.recalcSize();
        const playerY = GROUND_Y - player.drawH;

        // Camera shake on arrival
        let shakeX = 0;
        const arrivalT = (elapsed - 4.5) / 2.5;
        if (arrivalT > 0.8) {
            const shakeMag = Math.max(0, (1 - arrivalT) * 8);
            shakeX = Math.sin(elapsed * 30) * shakeMag;
        }

        ctx.save();
        ctx.translate(shakeX, 0);
        player.draw('run', introPlayerX, playerY);
        ctx.restore();

        // Text
        if (elapsed > 11.5) {
            const textAlpha = Math.min(1, (elapsed - 11.5) / 0.5);
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

    // SCENE 4: 10.5 – 16.0s — Logo reveal
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
            const letterT = (elapsed - 14.5 - letter.delay) / 0.4;
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
        if (elapsed > 17.0) {
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

function drawShopModal() {
    const w = canvas.width, h = canvas.height;
    
    ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
    ctx.fillRect(0, 0, w, h);
    
    const boxW = Math.min(w * 0.85, 450);
    const boxH = Math.min(h * 0.82, 380);
    const boxX = (w - boxW) / 2;
    const boxY = (h - boxH) / 2;
    
    ctx.fillStyle = '#2c1e13';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    
    ctx.strokeStyle = '#f0a500';
    ctx.lineWidth = 4;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    
    ctx.font = `${clampFont(14, 2, 20)}px "Press Start 2P"`;
    ctx.fillStyle = '#f0a500';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SQUIRREL SHOP', w / 2, boxY + 30);
    
    ctx.font = `${clampFont(8, 1, 10)}px "Press Start 2P"`;
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`YOUR ACORNS: ${walletAcorns} 🌰`, w / 2, boxY + 55);
    
    ctx.strokeStyle = '#4e3621';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boxX + 20, boxY + 70);
    ctx.lineTo(boxX + boxW - 20, boxY + 70);
    ctx.stroke();

    const itemH = 54;
    const startY = boxY + 85;
    
    for (let i = 0; i < HATS_LIST.length; i++) {
        const item = HATS_LIST[i];
        const itemY = startY + i * (itemH + 10);
        
        ctx.fillStyle = '#4e3621';
        ctx.fillRect(boxX + 20, itemY, boxW - 40, itemH);
        
        ctx.strokeStyle = (selectedHat === item.id) ? '#ffcc00' : '#2c1e13';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX + 20, itemY, boxW - 40, itemH);
        
        const px = boxX + 45;
        const py = itemY + itemH / 2;
        
        ctx.save();
        const prevHat = selectedHat;
        selectedHat = item.id;
        drawHat(ctx, px - 45, py - 38, 'idle', 0, 1.8);
        selectedHat = prevHat;
        ctx.restore();
        
        ctx.fillStyle = '#fff';
        ctx.font = `${clampFont(8, 1.1, 12)}px "Press Start 2P"`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.name, boxX + 90, itemY + itemH / 2);
        
        const btnW = 110;
        const btnH = 30;
        const btnX = boxX + boxW - btnW - 35;
        const btnY = itemY + (itemH - btnH) / 2;
        
        item.btnX = btnX;
        item.btnY = btnY;
        item.btnW = btnW;
        item.btnH = btnH;
        
        const isUnlocked = unlockedHats.includes(item.id);
        const isSelected = selectedHat === item.id;
        
        if (isSelected) {
            ctx.fillStyle = '#7ec850';
            ctx.fillRect(btnX, btnY, btnW, btnH);
            ctx.fillStyle = '#fff';
            ctx.font = `${clampFont(6, 0.9, 10)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('EQUIPPED', btnX + btnW / 2, btnY + btnH / 2);
        } else if (isUnlocked) {
            ctx.fillStyle = '#5c6b73';
            ctx.fillRect(btnX, btnY, btnW, btnH);
            ctx.fillStyle = '#fff';
            ctx.font = `${clampFont(6, 0.9, 10)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('EQUIP', btnX + btnW / 2, btnY + btnH / 2);
        } else {
            const canAfford = walletAcorns >= item.cost;
            ctx.fillStyle = canAfford ? '#ffb085' : '#888';
            ctx.fillRect(btnX, btnY, btnW, btnH);
            ctx.fillStyle = '#2c1e13';
            ctx.font = `${clampFont(6, 0.8, 9)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`BUY: ${item.cost}🌰`, btnX + btnW / 2, btnY + btnH / 2);
        }
    }
    
    const closeBtnW = 120;
    const closeBtnH = 34;
    shopCloseBtn = {
        x: w / 2 - closeBtnW / 2,
        y: boxY + boxH - closeBtnH - 20,
        w: closeBtnW,
        h: closeBtnH
    };
    
    ctx.fillStyle = '#ff4060';
    ctx.fillRect(shopCloseBtn.x, shopCloseBtn.y, shopCloseBtn.w, shopCloseBtn.h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(shopCloseBtn.x, shopCloseBtn.y, shopCloseBtn.w, shopCloseBtn.h);
    
    ctx.fillStyle = '#fff';
    ctx.font = `${clampFont(8, 1, 10)}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CLOSE', shopCloseBtn.x + shopCloseBtn.w / 2, shopCloseBtn.y + shopCloseBtn.h / 2);
}

function drawHome() {
    const w = canvas.width, h = canvas.height;
    const t = homeTime;

    // Layer 1: Background
    drawBackground(0.3);

    // Draw HATS SHOP Button in top right corner
    const shopW = 100;
    const shopH = 34;
    shopBtn = {
        x: w - shopW - 20,
        y: 20,
        w: shopW,
        h: shopH
    };
    
    ctx.save();
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(shopBtn.x, shopBtn.y, shopBtn.w, shopBtn.h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(shopBtn.x, shopBtn.y, shopBtn.w, shopBtn.h);
    
    ctx.fillStyle = '#2c1e13';
    ctx.font = `${clampFont(7, 0.9, 9)}px "Press Start 2P"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HATS 🎩', shopBtn.x + shopBtn.w / 2, shopBtn.y + shopBtn.h / 2);
    ctx.restore();

    // Layer 5: Props (home screen decorative)
    // Draw some static props near ground

    // Layer 6: Ground tiles
    drawGroundTiles();

    player.recalcSize();
    const homeGroundY = GROUND_Y - player.drawH;
    const breathScale = 1 + Math.sin(t * 2) * 0.02;

    // ── 3 COLLECTIBLE ACORNS with height-hint dashed lines ──
    const nut1X = w * 0.40;
    const nut2X = w * 0.58;
    const nut3X = w * 0.72;
    const nut1Y = homeGroundY;
    const nut2Y = GROUND_Y - player.drawH * 1.8;
    const nut3Y = GROUND_Y - player.drawH * 3.0;
    const acornScale = DYNAMIC_SCALE / 3;
    const acornDrawW = 16 * acornScale * 1.2;
    const acornDrawH = 14 * acornScale * 1.2;

    // Acorn 1 — ground level
    if (!homeAcorn1Collected && assets.acorn.complete) {
        const bob1 = Math.sin(t * 3) * 3;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#f0a500';
        const frame1 = Math.floor(t * 5) % 3;
        ctx.drawImage(assets.acorn, frame1 * 16, 0, 16, 14, nut1X + player.drawW * 0.3, nut1Y + bob1, acornDrawW, acornDrawH);
        ctx.restore();
    }

    // Acorn 2 — mid-air with dashed height hint line
    if (!homeAcorn2Collected && assets.acorn.complete) {
        const bob2 = Math.sin(t * 3 + 1) * 3;
        // Height hint dashed line
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(240,165,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nut2X + player.drawW * 0.3 + acornDrawW / 2, GROUND_Y);
        ctx.lineTo(nut2X + player.drawW * 0.3 + acornDrawW / 2, nut2Y + bob2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Acorn
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#f0a500';
        const frame2 = Math.floor(t * 5 + 1) % 3;
        ctx.drawImage(assets.acorn, frame2 * 16, 0, 16, 14, nut2X + player.drawW * 0.3, nut2Y + bob2, acornDrawW, acornDrawH);
        ctx.restore();
    }

    // Acorn 3 — high in air with dashed height hint line
    if (!homeAcorn3Collected && assets.acorn.complete) {
        const bob3 = Math.sin(t * 3 + 2) * 3;
        // Height hint dashed line
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(240,165,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nut3X + player.drawW * 0.3 + acornDrawW / 2, GROUND_Y);
        ctx.lineTo(nut3X + player.drawW * 0.3 + acornDrawW / 2, nut3Y + bob3);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // Acorn
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#f0a500';
        const frame3 = Math.floor(t * 5 + 2) % 3;
        ctx.drawImage(assets.acorn, frame3 * 16, 0, 16, 14, nut3X + player.drawW * 0.3, nut3Y + bob3, acornDrawW, acornDrawH);
        ctx.restore();
    }

    // ── SQUIRREL (only visible when NOT in_tree) ──
    if (homeSquirrelPhase !== 'in_tree') {
        const squirrelDrawY = homeSquirrelOnGround ? homeGroundY : homeSquirrelY;
        ctx.save();
        if (homeSquirrelPhase === 'return_tree') {
            // Flip horizontally for running left
            ctx.translate(homeSquirrelX + player.drawW, 0);
            ctx.scale(-1, 1);
            player.draw(player.animState, 0, squirrelDrawY, breathScale);
        } else {
            player.draw(player.animState, homeSquirrelX, squirrelDrawY, breathScale);
        }
        ctx.restore();
    }

    // Draw jump dust particles
    for (const dp of jumpDustParticles) dp.draw();

    // Draw collect burst particles
    for (const bp of homeCollectBurst) {
        ctx.save();
        ctx.globalAlpha = bp.life / 30;
        ctx.fillStyle = bp.color;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, bp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

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

    if (shopOpen) {
        drawShopModal();
    }

    // Fade-to-black transition with "The adventure begins!" text
    if (homeTransitioning) {
        ctx.fillStyle = `rgba(0,0,0,${homeTransitionAlpha})`;
        ctx.fillRect(0, 0, w, h);
        // Show "The adventure begins!" text during transition
        if (homeTransitionAlpha > 0.3) {
            ctx.globalAlpha = Math.min(1, (homeTransitionAlpha - 0.3) / 0.4);
            ctx.font = `${clampFont(14, 2, 22)}px "Press Start 2P"`;
            ctx.fillStyle = '#f0a500';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#f0a500';
            ctx.fillText('The adventure begins!', w / 2, h / 2);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }
}

function drawGameplay() {
    const w = canvas.width, h = canvas.height;

    // 1-3: Background layers
    drawBackground(1);

    // Apply Time of Day overlay tints + background stars/fireflies
    drawTimeOfDayOverlay();

    // 4: Props
    for (const p of propDecorations) p.draw();

    // 5: Acorns
    for (const a of acorns) a.draw();

    // 5.5: Powerups
    for (const p of powerups) p.draw();

    // 6: Ground tiles
    drawGroundTiles();

    // Draw jump dust particles
    for (const dp of jumpDustParticles) dp.draw();

    // Draw Giant Bee boss & Pinecones
    boss.draw();

    // Boss Warning Banner
    if (boss.active && boss.state === 'enter') {
        const blink = Math.floor(performance.now() / 250) % 2 === 0;
        if (blink) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            ctx.fillRect(0, h * 0.15, w, 50);
            
            ctx.fillStyle = '#fff';
            ctx.font = `${clampFont(10, 1.6, 14)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff0000';
            ctx.fillText('⚠️ WARNING: BOSS CHASE! ⚠️', w / 2, h * 0.15 + 25);
            ctx.restore();
        }
    }

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

    // 7.5: Player Shield Ring
    if (player.hasShield) {
        ctx.save();
        ctx.beginPath();
        const pulse = 1.0 + Math.sin(performance.now() / 150) * 0.1;
        const rx = player.width / 2;
        const ry = player.height / 2;
        const cx = player.x + rx;
        const cy = player.y + ry;
        ctx.arc(cx, cy, Math.max(player.width, player.height) * 0.85 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#7ec850';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#7ec850';
        ctx.stroke();
        ctx.restore();
    }

    // 8: Player
    player.draw();

    // 9: Score floaters
    for (const f of scoreFloaters) f.draw();

    // Gameplay falling leaves (drawn above ground, below HUD)
    for (const leaf of gameLeaves) leaf.draw();

    // Stage weather overlay
    for (const wp of weatherParticles) wp.draw();

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

        // Improvement tip panel
        if (elapsed > 1.2) {
            const tipAlpha = Math.min(1, (elapsed - 1.2) / 0.5);
            const tipBoxW = w * 0.5;
            const tipBoxH = h * 0.07;
            const tipBoxX = (w - tipBoxW) / 2;
            const tipBoxY = btnY + btnH + h * 0.10;

            ctx.save();
            ctx.globalAlpha = tipAlpha;
            ctx.fillStyle = 'rgba(240, 165, 0, 0.08)';
            ctx.fillRect(tipBoxX, tipBoxY, tipBoxW, tipBoxH);
            ctx.strokeStyle = 'rgba(240, 165, 0, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tipBoxX, tipBoxY, tipBoxW, tipBoxH);

            ctx.font = `${clampFont(6, 0.85, 10)}px "Press Start 2P"`;
            ctx.fillStyle = '#f0a500';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;
            ctx.fillText(IMPROVEMENT_TIPS[currentTipIndex], w / 2, tipBoxY + tipBoxH / 2);
            ctx.restore();
        }
    }
}

function drawVictory() {
    const w = canvas.width, h = canvas.height;
    const treeScale = DYNAMIC_SCALE / 3;
    const treeDrawW = 160 * treeScale;
    const treeDrawH = 200 * treeScale;
    const treeY = GROUND_Y - treeDrawH * 0.92;

    // ── Base: keep game world visible with gradient darkening ──
    drawBackground(0.2);
    drawGroundTiles();

    // Twinkling stars (always visible in victory)
    ctx.save();
    for (const star of victoryStars) {
        star.phase += star.speed;
        const alpha = 0.3 + Math.abs(Math.sin(star.phase)) * 0.7;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.restore();

    // Golden sky overlay that intensifies over time
    const skyAlpha = Math.min(0.55, victoryPhaseTimer * 0.003 + (victoryPhase >= 3 ? 0.3 : 0));
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
    skyGrad.addColorStop(0, `rgba(20, 5, 40, ${skyAlpha})`);
    skyGrad.addColorStop(1, `rgba(80, 30, 0, ${skyAlpha * 0.3})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.7);

    // ── FIREWORKS (phase 3+) ──
    if (victoryPhase >= 3) {
        ctx.save();
        for (const fw of victoryFireworks) {
            for (const p of fw.particles) {
                if (!p.x) continue;
                ctx.globalAlpha = (p.life / p.maxLife) * 0.9;
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 6;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ── TREE ──
    if (assets.tree && assets.tree.complete) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Phase 2: tree glows as squirrel enters
        if (victoryPhase === 2) {
            ctx.shadowBlur = 20 + Math.sin(victoryPhaseTimer * 0.3) * 10;
            ctx.shadowColor = '#f0a500';
        }
        ctx.drawImage(assets.tree, victoryTreeX, treeY, treeDrawW, treeDrawH);
        ctx.restore();
    } else {
        // Fallback: draw pixel tree with canvas
        ctx.save();
        ctx.fillStyle = '#7a3b10';
        ctx.fillRect(victoryTreeX + treeDrawW*0.35, treeY + treeDrawH*0.5, treeDrawW*0.3, treeDrawH*0.5);
        ctx.fillStyle = '#2e8b1a';
        ctx.beginPath();
        ctx.ellipse(victoryTreeX + treeDrawW/2, treeY + treeDrawH*0.35, treeDrawW*0.5, treeDrawH*0.45, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    // ── SQUIRREL (phases 0-1: visible running; phase 2: shrinks into hollow) ──
    if (victoryPhase <= 1) {
        player.recalcSize();
        player.draw(player.animState, victorySquirrelX, victorySquirrelY, 1);
    } else if (victoryPhase === 2) {
        // Squirrel shrinks and fades into hollow
        const shrinkT = Math.min(1, victoryPhaseTimer / 35);
        const shrinkScale = 1 - shrinkT * 0.85;
        const alphaFade = 1 - shrinkT;
        player.recalcSize();
        ctx.save();
        ctx.globalAlpha = alphaFade;
        const cx = victoryTreeX + treeDrawW * 0.38;
        const cy = GROUND_Y - player.drawH * (0.5 + shrinkT * 0.3);
        ctx.translate(cx + player.drawW/2, cy + player.drawH/2);
        ctx.scale(shrinkScale, shrinkScale);
        player.draw('idle', -player.drawW/2, -player.drawH/2, 1);
        ctx.restore();

        // Golden flash as squirrel enters
        if (shrinkT > 0.5) {
            const flashAlpha = (shrinkT - 0.5) * 2 * 0.3;
            ctx.fillStyle = `rgba(255, 200, 0, ${flashAlpha})`;
            ctx.fillRect(0, 0, w, h);
        }
    }

    // ── PHASE 0: "GOAL REACHED!" flash ──
    if (victoryPhase === 0) {
        const flashT = Math.min(1, victoryPhaseTimer / 30);
        const flashAlpha = flashT < 0.5 ? flashT * 2 : (1 - flashT) * 2;
        ctx.fillStyle = `rgba(255,220,0,${flashAlpha * 0.6})`;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.globalAlpha = flashT;
        ctx.fillStyle = '#ffd700';
        ctx.font = `${clampFont(18, 3, 36)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ffd700';
        ctx.fillText('1000 REACHED!', w/2, h * 0.22);
        ctx.restore();
    }

    // ── PHASE 1: "Running home..." text ──
    if (victoryPhase === 1) {
        const textAlpha = Math.min(1, victoryPhaseTimer / 20);
        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.fillStyle = '#f0a500';
        ctx.font = `${clampFont(10, 1.5, 18)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#000';
        ctx.fillText('Heading home...', w/2, h * 0.15);
        ctx.restore();
    }

    // ── PHASE 2: "Safe at last!" ──
    if (victoryPhase === 2) {
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = `${clampFont(9, 1.3, 16)}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#000';
        ctx.globalAlpha = Math.min(1, victoryPhaseTimer / 15);
        ctx.fillText('Safe at last!', w/2, h * 0.15);
        ctx.restore();
    }

    // ── PHASE 3+: Big VICTORY! title with letter-by-letter reveal ──
    if (victoryPhase >= 3) {
        const titleLetters = 'VICTORY!';
        const titleSize = clampFont(26, 4.5, 54);
        ctx.font = `${titleSize}px "Press Start 2P"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const totalW = ctx.measureText(titleLetters).width;
        let startX = w/2 - totalW/2;

        for (let i = 0; i < titleLetters.length; i++) {
            const delay = i * 8;
            const t = Math.min(1, Math.max(0, victoryPhaseTimer - delay) / 20);
            const bounce = t < 1 ? (1 - Math.pow(1-t, 3)) : 1;
            const lx = startX + ctx.measureText(titleLetters.substring(0, i)).width + ctx.measureText(titleLetters[i]).width/2;
            const ly = h * 0.18 - (1-bounce) * 80;

            ctx.save();
            ctx.globalAlpha = t;
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#ffd700';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(titleLetters[i], lx, ly);
            // Second pass for glow
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = '#fffaaa';
            ctx.fillText(titleLetters[i], lx, ly);
            ctx.restore();
        }

        // Score panel (appears after 60 frames into phase 3)
        if (victoryPhaseTimer > 60) {
            const panelAlpha = Math.min(1, (victoryPhaseTimer - 60) / 30);
            const panelW = w * 0.52;
            const panelH = h * 0.22;
            const panelX = (w - panelW) / 2;
            const panelY = h * 0.30;

            ctx.save();
            ctx.globalAlpha = panelAlpha;

            // Panel bg
            ctx.fillStyle = 'rgba(5,5,20,0.85)';
            ctx.fillRect(panelX, panelY, panelW, panelH);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.strokeRect(panelX, panelY, panelW, panelH);

            // Inner gold top line
            ctx.strokeStyle = 'rgba(255,215,0,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(panelX+4, panelY+4, panelW-8, panelH-8);

            ctx.fillStyle = '#ffffff';
            ctx.font = `${clampFont(8, 1.2, 13)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 0;

            // Final score
            ctx.fillText(`FINAL SCORE`, w/2, panelY + panelH*0.28);
            ctx.fillStyle = '#ffd700';
            ctx.font = `${clampFont(14, 2.2, 24)}px "Press Start 2P"`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ffd700';
            ctx.fillText(score.toString().padStart(6,'0'), w/2, panelY + panelH*0.56);

            // Best score row
            ctx.shadowBlur = 0;
            ctx.font = `${clampFont(7, 1.0, 11)}px "Press Start 2P"`;
            ctx.fillStyle = score >= highScore ? '#44ff88' : '#aaaaaa';
            ctx.fillText(`BEST: ${highScore.toString().padStart(6,'0')}${score >= highScore ? ' ★ NEW!' : ''}`,
                w/2, panelY + panelH*0.82);

            ctx.restore();
        }

        // "You escaped the forest!" subtitle (120 frames in)
        if (victoryPhaseTimer > 120) {
            const subAlpha = Math.min(1, (victoryPhaseTimer - 120) / 30);
            ctx.save();
            ctx.globalAlpha = subAlpha;
            ctx.fillStyle = '#66fcf1';
            ctx.font = `${clampFont(7, 1.0, 11)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#66fcf1';
            ctx.fillText('YOU ESCAPED THE FOREST!', w/2, h * 0.58);
            ctx.restore();
        }

        // Leaf rain in celebration
        if (victoryPhaseTimer % 6 === 0 && homeParticles.length < 80) {
            homeParticles.push(new LeafParticle());
        }
        for (const p of homeParticles) {
            p.update(victoryPhaseTimer / 60);
            p.draw();
        }
    }

    // ── PHASE 4: Restart prompt ──
    if (victoryPhase >= 4) {
        const blink = Math.floor(performance.now() / 450) % 2 === 0;
        if (blink) {
            ctx.save();
            ctx.fillStyle = '#ffd700';
            ctx.font = `${clampFont(8, 1.2, 13)}px "Press Start 2P"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ffd700';
            ctx.fillText('Press SPACE to Play Again', w/2, h * 0.74);
            ctx.restore();
        }
    }

    // Vignette on top of everything
    drawVignette();

    // Reset canvas state
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.textBaseline = 'alphabetic';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    // Pre-populate with 30 leaves so screen isn't empty at home screen start
    for (let i = 0; i < 30; i++) {
        const p = new LeafParticle();
        p.y = Math.random() * GROUND_Y;   // scattered at random heights already
        homeParticles.push(p);
    }
    frameCount = 0;
    bgX1 = 0; bgX2 = 0; bgX3 = 0; groundScrollX = 0;

    // Initialize home squirrel tree animation (8-phase)
    player.recalcSize();
    homeTreeX = -player.drawW - 50;
    homeSquirrelPhase = 'in_tree';
    homeSquirrelTimer = 0;
    homeSquirrelX = homeTreeX + player.drawW * 0.3;
    homeSquirrelY = GROUND_Y - player.drawH;
    homeSquirrelVelY = 0;
    homeSquirrelOnGround = true;
    homeSquirrelJumpsLeft = 2;
    homeAcorn1Collected = false;
    homeAcorn2Collected = false;
    homeAcorn3Collected = false;
    homeCollectBurst = [];
    jumpDustParticles = [];

    player.animState = 'idle';
    player.animFrame = 0;
    player.animTimer = 0;
    player.y = GROUND_Y - player.drawH;

    // Play music on home screen at softer volume
    const music = getMusicAudio();
    if (music) {
        music.volume = 0.20;   // softer on home screen
        music.play().catch(() => {});
    }
}

function handleHomeStart() {
    initAudio();
    if (!homeTransitioning) {
        homeTransitioning = true;
        homeTransitionAlpha = 0;
        // Ramp up music volume as game starts
        const music = getMusicAudio();
        if (music) music.volume = 0.35;
    }
}

// ═══════════════════════════════════════════════════
// INPUT
// ═══════════════════════════════════════════════════
function handleActionInput(e) {
    initAudio();

    if (currentState === STATES.INTRO) {
        // Allow skipping only after the "Press SPACE or TAP to begin" prompt is visible (elapsed >= 17.0)
        const elapsed = performance.now() / 1000 - introStartTime;
        if (elapsed >= 17.0) {
            introSkipped = true;
            goToHome();
        }
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

function handleShopClicks(mx, my) {
    if (isPointInRect(mx, my, shopCloseBtn.x, shopCloseBtn.y, shopCloseBtn.w, shopCloseBtn.h)) {
        shopOpen = false;
        playCollectSound();
        return true;
    }
    
    for (const item of HATS_LIST) {
        if (item.btnX && isPointInRect(mx, my, item.btnX, item.btnY, item.btnW, item.btnH)) {
            const isUnlocked = unlockedHats.includes(item.id);
            if (isUnlocked) {
                selectedHat = item.id;
                localStorage.setItem('squirrelgame_selected_hat', selectedHat);
                playJumpSound(false);
            } else {
                if (walletAcorns >= item.cost) {
                    walletAcorns -= item.cost;
                    localStorage.setItem('squirrelgame_wallet', walletAcorns.toString());
                    
                    unlockedHats.push(item.id);
                    localStorage.setItem('squirrelgame_unlocked_hats', JSON.stringify(unlockedHats));
                    
                    selectedHat = item.id;
                    localStorage.setItem('squirrelgame_selected_hat', selectedHat);
                    playCollectSound();
                } else {
                    if (audioCtx) {
                        const osc = audioCtx.createOscillator();
                        const gain = audioCtx.createGain();
                        osc.connect(gain);
                        gain.connect(audioCtx.destination);
                        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
                        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                        gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
                        osc.start();
                        osc.stop(audioCtx.currentTime + 0.15);
                    }
                }
            }
            return true;
        }
    }
    return true;
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
        if (gameOverRestartBtn && isPointInRect(mx, my, gameOverRestartBtn.x, gameOverRestartBtn.y, gameOverRestartBtn.w, gameOverRestartBtn.h)) {
            currentState = STATES.PLAYING;
            resetGame();
            return;
        }
        if (gameOverHomeBtn && isPointInRect(mx, my, gameOverHomeBtn.x, gameOverHomeBtn.y, gameOverHomeBtn.w, gameOverHomeBtn.h)) {
            goToHome();
            return;
        }
        handleActionInput(e);
    } else if (currentState === STATES.HOME) {
        if (shopOpen) {
            handleShopClicks(mx, my);
        } else if (shopBtn && isPointInRect(mx, my, shopBtn.x, shopBtn.y, shopBtn.w, shopBtn.h)) {
            shopOpen = true;
            playCollectSound();
        } else {
            handleActionInput(e);
        }
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
            goToHome();
            return;
        }
        handleActionInput(e);
    } else if (currentState === STATES.HOME) {
        if (shopOpen) {
            handleShopClicks(mx, my);
        } else if (shopBtn && isPointInRect(mx, my, shopBtn.x, shopBtn.y, shopBtn.w, shopBtn.h)) {
            shopOpen = true;
            playCollectSound();
        } else {
            handleActionInput(e);
        }
    } else {
        handleActionInput(e);
    }
}, { passive: false });

// ═══════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════
initIntro();
requestAnimationFrame(gameLoop);
