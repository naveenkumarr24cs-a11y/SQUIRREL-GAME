/**
 * SUNNY DASH — Complete 2D Endless Runner Game Engine
 * Pixel-perfect retro arcade style upscaled 3x.
 * Built with HTML5 Canvas, Web Audio API, and vanilla JavaScript.
 */

// --- Canvas Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Game Configurations ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 300;
const GROUND_Y = 240; // Tuned y=240 to avoid pixel clipping and allow 60px ground height
const GRAVITY = 0.6;
const JUMP_VELOCITY = -12.0;

// Game States
const STATES = {
    START_SCREEN: 'START_SCREEN',
    PLAYING: 'PLAYING',
    DEATH_ANIMATION: 'DEATH_ANIMATION',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY'
};
let currentState = STATES.START_SCREEN;

// --- Assets Manager ---
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

// Set sources
assets.bgLayer1.src = 'assets/background/layer-1.png';
assets.bgLayer2.src = 'assets/background/layer-2.png';
assets.bgLayer3.src = 'assets/background/layer-3.png';
assets.tileset.src = 'assets/tileset.png';
assets.props.src = 'assets/props.png';
assets.player.src = 'assets/player.png';
assets.frog.src = 'assets/enemies/frog.png';
assets.opossum.src = 'assets/enemies/opossum.png';
assets.bee.src = 'assets/enemies/bee.png';
assets.acorn.src = 'assets/acorn.png';

// Verify assets loaded
let assetsLoaded = 0;
const totalAssets = Object.keys(assets).length;
let isGameReady = false;

Object.values(assets).forEach(img => {
    img.onload = () => {
        assetsLoaded++;
        if (assetsLoaded === totalAssets) {
            isGameReady = true;
            const statusEl = document.getElementById('arcadeStatusText');
            if (statusEl) statusEl.innerText = 'INSERT COIN / PRESS SPACE';
        }
    };
    img.onerror = () => {
        console.error(`Failed to load asset: ${img.src}`);
    };
});

// --- Audio Synthesizer (Web Audio API) ---
let audioCtx = null;

function getMusicAudio() {
    return document.getElementById('bgMusic');
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Play Background Music
function playMusic() {
    initAudio();
    const music = getMusicAudio();
    if (music) {
        music.volume = 0.4;
        music.play().catch(err => console.log('Music autoplay blocked:', err));
    }
}

// Stop Background Music
function stopMusic() {
    const music = getMusicAudio();
    if (music) {
        music.pause();
        music.currentTime = 0;
    }
}

// Synth SFX 1: Jump (Whoosh sweep up / Double Jump)
function playJumpSound(isSecond) {
    if (!audioCtx) return;
    initAudio();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (isSecond) {
        // playTone(420, 'square', 0.18, 0.12, 700)
        osc.type = 'square';
        osc.frequency.setValueAtTime(420, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, audioCtx.currentTime + 0.18);

        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
    } else {
        // playTone(300, 'square', 0.18, 0.12, 550)
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(550, audioCtx.currentTime + 0.18);

        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
    }

    osc.start();
    osc.stop(audioCtx.currentTime + 0.18);
}

// Synth SFX 2: Collect (Double Ping)
function playCollectSound() {
    if (!audioCtx) return;
    initAudio();

    // First Ping
    const osc1 = audioCtx.createOscillator();
    const gainNode1 = audioCtx.createGain();
    osc1.connect(gainNode1);
    gainNode1.connect(audioCtx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, audioCtx.currentTime);
    gainNode1.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.08);

    // Second Ping (Delayed)
    const osc2 = audioCtx.createOscillator();
    const gainNode2 = audioCtx.createGain();
    osc2.connect(gainNode2);
    gainNode2.connect(audioCtx.destination);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.06);
    gainNode2.gain.setValueAtTime(0.2, audioCtx.currentTime + 0.06);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.21);
    osc2.start(audioCtx.currentTime + 0.06);
    osc2.stop(audioCtx.currentTime + 0.21);
}

// Synth SFX 3: Death (Descending low pass filter)
function playDeathSound() {
    if (!audioCtx) return;
    initAudio();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.6);

    gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
}


// --- Game State Variables ---
let gameSpeed = 3.0;
let distance = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('sunny_dash_highscore') || '0', 10);
let frameCount = 0;
let flashTimer = 0; // For item collection screen flash
let currentStage = 1;
let stageBannerTimer = 0;
let stageBannerText = '';
const WINNING_SCORE = 1000;

// Background Positions
let bgX1 = 0;
let bgX2 = 0;
let bgX3 = 0;
let groundScrollX = 0;

// Spawning Intervals (in milliseconds)
let nextEnemySpawnTime = 0;
let nextAcornSpawnTime = 0;
let nextPropSpawnTime = 0;

// Lists
let enemies = [];
let acorns = [];
let propDecorations = []; // Static visual props (branches, leaves)

// --- Entities Setup ---

// Player Object (AABB Bounding Box based)
const player = {
    // Collision Bounding Box (offset and scaled)
    x: 100,
    y: GROUND_Y - 57, 
    width: 42,   // 14 x 3
    height: 57,  // 19 x 3
    
    // Physics
    velY: 0,
    isGrounded: true,
    jumpsLeft: 2,
    
    // Animation States
    animState: 'run',
    animFrame: 0,
    animTimer: 0,
    deathTimer: 0,

    reset() {
        this.y = GROUND_Y - 57;
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
        
        if (this.jumpsLeft === 1) {
            // Second jump is 85% strength
            this.velY = JUMP_VELOCITY * 0.85;
        } else {
            // First jump is 100% strength
            this.velY = JUMP_VELOCITY;
        }
        
        this.jumpsLeft--;
        this.isGrounded = false;
        playJumpSound(isSecond);
    },

    update(speed) {
        // Gravity physics
        this.velY += GRAVITY;
        this.y += this.velY;

        // Ground detection
        const limitY = GROUND_Y - this.height;
        if (this.y >= limitY) {
            this.y = limitY;
            this.velY = 0;
            this.isGrounded = true;
            this.jumpsLeft = 2; // Reset jump count on landing
        }

        // Determine correct animation state
        if (currentState === STATES.DEATH_ANIMATION) {
            this.animState = 'death';
        } else if (!this.isGrounded) {
            if (this.velY < 0) {
                this.animState = 'jump';
            } else {
                this.animState = 'fall';
            }
        } else {
            this.animState = 'run';
        }

        // Animation timing
        this.animTimer++;
        if (this.animState === 'run') {
            // Run animation frames 6, rate 10fps (approx 6 frames of 60Hz per animation frame)
            if (this.animTimer >= 6) {
                this.animFrame = (this.animFrame + 1) % 6;
                this.animTimer = 0;
            }
        } else if (this.animState === 'jump') {
            this.animFrame = 0; // jump frame (index 10 in sheet)
        } else if (this.animState === 'fall') {
            this.animFrame = 0; // fall frame (index 11 in sheet)
        } else if (this.animState === 'death') {
            // Death anim (hurt alternating 6 frames, approx 8 frames per sprite)
            if (this.animTimer >= 8) {
                this.animFrame = (this.animFrame + 1) % 6;
                this.animTimer = 0;
            }
        } else {
            // Idle
            if (this.animTimer >= 10) {
                this.animFrame = (this.animFrame + 1) % 4;
                this.animTimer = 0;
            }
        }
    },

    draw() {
        ctx.imageSmoothingEnabled = false;

        // Stitched Sheet mapping indices:
        // Idle(4f): indices 0 to 3
        // Run(6f): indices 4 to 9
        // Jump(1f): index 10
        // Fall(1f): index 11
        // Death(6f): indices 12 to 17
        let spriteIndex = 0;
        if (this.animState === 'run') {
            spriteIndex = 4 + this.animFrame;
        } else if (this.animState === 'jump') {
            spriteIndex = 10;
        } else if (this.animState === 'fall') {
            spriteIndex = 11;
        } else if (this.animState === 'death') {
            spriteIndex = 12 + this.animFrame;
        } else {
            // Idle
            spriteIndex = this.animFrame % 4;
        }

        // Source coordinates inside 1620x58 sheet
        const frameW = 90;
        const frameH = 58;
        const sx = spriteIndex * frameW;
        const sy = 0;

        // Bounding Box aligned rendering offsets upscaled 3x
        // dx = x - offset_x * 3 = x - 37 * 3 = x - 111
        // dy = y - offset_y * 3 = y - 29 * 3 = y - 87
        const dx = this.x - 111;
        const dy = this.y - 87;
        const dw = frameW * 3;
        const dh = frameH * 3;

        ctx.drawImage(assets.player, sx, sy, frameW, frameH, dx, dy, dw, dh);

        // Debug hitboxes (optional/commented out)
        /*
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        */
    }
};

// --- Enemy Classes ---
class Enemy {
    constructor(type, x) {
        this.type = type;
        this.x = x;
        this.width = 0;
        this.height = 0;
        this.y = 0;
        this.animFrame = 0;
        this.animTimer = 0;
        this.speedOffset = 0;

        // Initialize properties per enemy type
        if (type === 'frog') {
            // Grasshopper: width 15, height 15 (offset x=21, y=18), frame size 52x45
            this.width = 45;
            this.height = 45;
            this.y = GROUND_Y - this.height;
            this.frameWidth = 52;
            this.frameHeight = 45;
            this.frameCount = 8; // 4 idle, 2 jump, 2 fall
            this.sheet = assets.frog;
            this.offsetX = 21;
            this.offsetY = 18;
            this.animState = 'idle'; // hops forward
            this.velY = 0;
            this.isGrounded = true;
            this.speedOffset = -0.5; // hops speed difference
        } else if (type === 'opossum') {
            // Ant: width 19, height 14 (offset x=13, y=17), frame size 37x31
            this.width = 57;
            this.height = 42;
            this.y = GROUND_Y - this.height;
            this.frameWidth = 37;
            this.frameHeight = 31;
            this.frameCount = 8; // 8 walk
            this.sheet = assets.opossum;
            this.offsetX = 13;
            this.offsetY = 17;
            this.speedOffset = 0.8; // moves slightly faster
        } else if (type === 'bee') {
            // Gator: width 16, height 21 (offset x=15, y=20), frame size 46x49
            this.width = 48;
            this.height = 63;
            this.y = 100; // mid-air floating obstacle
            this.frameWidth = 46;
            this.frameHeight = 49;
            this.frameCount = 4; // 4 fly
            this.sheet = assets.bee;
            this.offsetX = 15;
            this.offsetY = 20;
            this.speedOffset = 0.2;
            this.sineTimer = Math.random() * Math.PI * 2;
        }
    }

    update(speed) {
        // Move left
        this.x -= (speed + this.speedOffset);

        // Update Frog hopping physics
        if (this.type === 'frog') {
            this.animTimer++;
            
            // Randomly trigger hop
            if (this.isGrounded && this.animTimer > 80 + Math.random() * 40) {
                this.velY = -8.0;
                this.isGrounded = false;
                this.animState = 'jump';
                this.animTimer = 0;
            }

            // Apply gravity to hop
            if (!this.isGrounded) {
                this.velY += GRAVITY;
                this.y += this.velY;

                if (this.velY >= 0) {
                    this.animState = 'fall';
                }

                const limitY = GROUND_Y - this.height;
                if (this.y >= limitY) {
                    this.y = limitY;
                    this.velY = 0;
                    this.isGrounded = true;
                    this.animState = 'idle';
                    this.animTimer = 0;
                }
            }

            // Animate
            if (this.animState === 'idle') {
                if (this.animTimer % 8 === 0) {
                    this.animFrame = (this.animFrame + 1) % 4; // idle frames: index 0 to 3
                }
            } else if (this.animState === 'jump') {
                // jump frames: index 4 to 5
                this.animFrame = 4 + (Math.floor(this.animTimer / 6) % 2);
            } else if (this.animState === 'fall') {
                // fall frames: index 6 to 7
                this.animFrame = 6 + (Math.floor(this.animTimer / 6) % 2);
            }
        } 
        
        // Update Opossum walking
        else if (this.type === 'opossum') {
            this.animTimer++;
            if (this.animTimer >= 6) {
                this.animFrame = (this.animFrame + 1) % 8; // walk frames 8
                this.animTimer = 0;
            }
        } 
        
        // Update Bee sinusoidal hovering
        else if (this.type === 'bee') {
            this.sineTimer += 0.05;
            this.y = 90 + Math.sin(this.sineTimer) * 20;

            this.animTimer++;
            if (this.animTimer >= 8) {
                this.animFrame = (this.animFrame + 1) % 4; // fly frames 4
                this.animTimer = 0;
            }
        }
    }

    draw() {
        ctx.imageSmoothingEnabled = false;

        const sx = this.animFrame * this.frameWidth;
        const sy = 0;

        const dx = this.x - this.offsetX * 3;
        const dy = this.y - this.offsetY * 3;
        const dw = this.frameWidth * 3;
        const dh = this.frameHeight * 3;

        // Draw flipped horizontally so they run left (player runs right)
        ctx.save();
        ctx.translate(dx + dw/2, dy + dh/2);
        ctx.scale(-1, 1); // Flip horizontally
        ctx.drawImage(this.sheet, sx, sy, this.frameWidth, this.frameHeight, -dw/2, -dh/2, dw, dh);
        ctx.restore();

        // Debug hitboxes (optional/commented out)
        /*
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        */
    }
}

// --- Acorn Class (Collectible) ---
class Acorn {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 48;  // 16 * 3
        this.height = 42; // 14 * 3
        this.animFrame = 0;
        this.animTimer = 0;
    }

    update(speed) {
        this.x -= speed;

        this.animTimer++;
        if (this.animTimer >= 8) {
            this.animFrame = (this.animFrame + 1) % 3; // 3 animation frames
            this.animTimer = 0;
        }
    }

    draw() {
        ctx.imageSmoothingEnabled = false;

        const sx = this.animFrame * 16;
        const sy = 0;

        ctx.drawImage(assets.acorn, sx, sy, 16, 14, this.x, this.y, this.width, this.height);
    }
}

// --- Prop decoration Class (Branches/Leaves) ---
class PropDecoration {
    constructor(type, x) {
        this.type = type; // branch-01 to branch-05, leaves
        this.x = x;
        
        // Define coordinates inside assets/props.png
        // Sourced from atlas-props.json
        const propSheets = {
            'branch-01': { sx: 2, sy: 2, sw: 54, sh: 56 },
            'branch-02': { sx: 58, sy: 2, sw: 80, sh: 51 },
            'branch-03': { sx: 140, sy: 2, sw: 94, sh: 53 },
            'branch-04': { sx: 236, sy: 2, sw: 136, sh: 88 },
            'branch-05': { sx: 374, sy: 2, sw: 130, sh: 37 },
            'leaves': { sx: 506, sy: 2, sw: 150, sh: 103 }
        };

        const propData = propSheets[type];
        this.sx = propData.sx;
        this.sy = propData.sy;
        this.sw = propData.sw;
        this.sh = propData.sh;

        // Dimensions upscaled 3x
        this.width = this.sw * 3;
        this.height = this.sh * 3;

        // Position on the ground, or floating for leaves
        if (type === 'leaves') {
            this.y = 10 + Math.random() * 40; // Float high up
        } else {
            this.y = GROUND_Y - this.height + 6; // Sit slightly embedded in the grass
        }
    }

    update(speed) {
        // Scrolls in sync with the ground (1x speed)
        this.x -= speed;
    }

    draw() {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(assets.props, this.sx, this.sy, this.sw, this.sh, this.x, this.y, this.width, this.height);
    }
}


// --- Collision Logic (AABB) ---
function checkAABBCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Check all collisions
function checkCollisions() {
    // 1. Collectible Acorns
    for (let i = acorns.length - 1; i >= 0; i--) {
        if (checkAABBCollision(player, acorns[i])) {
            acorns.splice(i, 1);
            score += 5;
            playCollectSound();
            flashTimer = 8; // Screen flash duration
        }
    }

    // 2. Obstacles
    for (let i = 0; i < enemies.length; i++) {
        if (checkAABBCollision(player, enemies[i])) {
            triggerDeathState();
            break;
        }
    }
}

// Trigger Death Animation State
function triggerDeathState() {
    currentState = STATES.DEATH_ANIMATION;
    player.reset(); // Stop jump/falling states
    player.animState = 'death';
    player.animFrame = 0;
    player.animTimer = 0;
    player.deathTimer = 0;
    
    stopMusic();
    playDeathSound();
}


// --- Game Initialization & Loops ---

function resetGame() {
    gameSpeed = 3.0;
    score = 0;
    distance = 0;
    frameCount = 0;
    flashTimer = 0;
    currentStage = 1;
    stageBannerTimer = 180;
    stageBannerText = "STAGE 1: SUNSET VALLEY";

    bgX1 = 0;
    bgX2 = 0;
    bgX3 = 0;
    groundScrollX = 0;

    enemies = [];
    acorns = [];
    propDecorations = [];

    // Pre-populate some static props in the distance
    propDecorations.push(new PropDecoration('branch-01', 300));
    propDecorations.push(new PropDecoration('branch-05', 600));

    player.reset();

    // Spawning timers (immediate offset)
    const now = performance.now();
    nextEnemySpawnTime = now + 1500;
    nextAcornSpawnTime = now + 2000;
    nextPropSpawnTime = now + 1000;

    playMusic();
}

function handleSpawns(now) {
    // 1. Enemy spawning (Frog, Opossum, Bee)
    if (now >= nextEnemySpawnTime) {
        // As speed increases, scale down spawn interval (gets much harder!)
        const minInterval = 1200;
        const maxInterval = 3200;
        const difficultyFactor = Math.max(0.4, 3.0 / gameSpeed);
        
        const nextInterval = minInterval + Math.random() * (maxInterval - minInterval) * difficultyFactor;
        nextEnemySpawnTime = now + nextInterval;

        // Choose enemy type dynamically
        // At higher speeds, flying bees spawn more often
        const rand = Math.random();
        let enemyType = 'opossum'; // default walk
        if (rand < 0.35) {
            enemyType = 'frog'; // hop
        } else if (rand < 0.60) {
            enemyType = 'bee'; // flying obstacle
        }
        
        enemies.push(new Enemy(enemyType, CANVAS_WIDTH + 100));
    }

    // 2. Acorn spawning
    if (now >= nextAcornSpawnTime) {
        const interval = 2500 + Math.random() * 3000;
        nextAcornSpawnTime = now + interval;

        // Spawn above ground level
        const acornY = 120 + Math.random() * 60;
        acorns.push(new Acorn(CANVAS_WIDTH + 50, acornY));
    }

    // 3. Background Prop decorations spawning
    if (now >= nextPropSpawnTime) {
        const interval = 3000 + Math.random() * 5000;
        nextPropSpawnTime = now + interval;

        const propTypes = ['branch-01', 'branch-02', 'branch-03', 'branch-04', 'branch-05', 'leaves'];
        const randomProp = propTypes[Math.floor(Math.random() * propTypes.length)];
        propDecorations.push(new PropDecoration(randomProp, CANVAS_WIDTH + 200));
    }
}

// --- Main Engine Update Loop ---
function update(now) {
    // Always sync HUD overlays in all states
    const scoreEl = document.getElementById('score-display');
    const hiscoreEl = document.getElementById('hiscore-display');
    if (scoreEl) scoreEl.innerText = score.toString().padStart(6, '0');
    if (hiscoreEl) hiscoreEl.innerText = highScore.toString().padStart(6, '0');

    if (currentState === STATES.PLAYING) {
        frameCount++;
        
        // Auto-run score increment: +1 every 10 frames
        if (frameCount % 10 === 0) {
            score += 1;
        }

        // Speed Scaling: speed += 0.0005 per frame (up to max 10.0)
        if (gameSpeed < 10.0) {
            gameSpeed += 0.0005;
        }

        // Update background layer positions (Parallax scrolling horizontally)
        // Layer 1: 0.2x speed
        bgX1 -= (gameSpeed * 0.2);
        if (bgX1 <= -CANVAS_WIDTH) bgX1 += CANVAS_WIDTH;

        // Layer 2: 0.5x speed
        bgX2 -= (gameSpeed * 0.5);
        if (bgX2 <= -CANVAS_WIDTH) bgX2 += CANVAS_WIDTH;

        // Layer 3: 1.0x speed
        bgX3 -= gameSpeed;
        if (bgX3 <= -CANVAS_WIDTH) bgX3 += CANVAS_WIDTH;

        // Ground Tiles Scroll: 1.0x speed
        groundScrollX -= gameSpeed;
        if (groundScrollX <= -48) groundScrollX += 48; // tile width is 48px

        // Spawns
        handleSpawns(now);

        // Update player
        player.update(gameSpeed);

        // Update props
        for (let i = propDecorations.length - 1; i >= 0; i--) {
            propDecorations[i].update(gameSpeed);
            if (propDecorations[i].x < -propDecorations[i].width) {
                propDecorations.splice(i, 1);
            }
        }

        // Update enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            enemies[i].update(gameSpeed);
            if (enemies[i].x < -enemies[i].width - 100) {
                enemies.splice(i, 1);
            }
        }

        // Update acorns
        for (let i = acorns.length - 1; i >= 0; i--) {
            acorns[i].update(gameSpeed);
            if (acorns[i].x < -acorns[i].width) {
                acorns.splice(i, 1);
            }
        }

        // Check Collisions
        checkCollisions();

        // Stage Progress and Win Condition Checks
        if (score >= WINNING_SCORE) {
            currentState = STATES.VICTORY;
            stopMusic();
            // Save high score to localStorage if higher
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('sunny_dash_highscore', highScore.toString());
            }
            document.getElementById('victoryScoreVal').innerText = score;
            document.getElementById('victoryOverlay').classList.remove('overlay-hidden');
            const statusEl = document.getElementById('arcadeStatusText');
            if (statusEl) statusEl.innerText = 'VICTORY - YOU WIN!';
        } else if (score >= 600 && currentStage < 3) {
            currentStage = 3;
            stageBannerTimer = 180;
            stageBannerText = "FINAL STAGE: GOLDEN RUN";
            gameSpeed += 0.8;
            playCollectSound(); // sound indicator
        } else if (score >= 300 && currentStage < 2) {
            currentStage = 2;
            stageBannerTimer = 180;
            stageBannerText = "STAGE 2: MIDNIGHT WOODS";
            gameSpeed += 0.5;
            playCollectSound(); // sound indicator
        }

        if (stageBannerTimer > 0) {
            stageBannerTimer--;
        }

        if (flashTimer > 0) flashTimer--;
    } 
    
    // Death Animation State Update
    else if (currentState === STATES.DEATH_ANIMATION) {
        player.update(0);
        player.deathTimer++;

        // Freeze frame/fade sequence before game over screen
        if (player.deathTimer >= 90) { // 1.5 seconds at 60fps
            currentState = STATES.GAME_OVER;
            
            // Save high score to localStorage
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('sunny_dash_highscore', highScore.toString());
            }

            document.getElementById('currentScoreVal').innerText = score;
            document.getElementById('highScoreVal').innerText = highScore;
            document.getElementById('gameOverOverlay').classList.remove('overlay-hidden');
            const statusEl = document.getElementById('arcadeStatusText');
            if (statusEl) statusEl.innerText = 'GAME OVER - PRESS SPACE';
        }
    }
}

// --- Main Engine Render Loop ---
function draw() {
    // Clear Canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.imageSmoothingEnabled = false;

    // 1. Draw Background Layer 1 (Sky / Clouds) - scrolls at 0.2x
    ctx.drawImage(assets.bgLayer1, bgX1, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(assets.bgLayer1, bgX1 + CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw Background Layer 2 (Mountains / Mid Trees) - scrolls at 0.5x
    ctx.drawImage(assets.bgLayer2, bgX2, -20, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(assets.bgLayer2, bgX2 + CANVAS_WIDTH, -20, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 3. Draw Background Layer 3 (Near Ground Bushes / Back Trees) - scrolls at 1.0x
    ctx.drawImage(assets.bgLayer3, bgX3, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(assets.bgLayer3, bgX3 + CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 4. Draw Props / Static visual decorations
    for (let i = 0; i < propDecorations.length; i++) {
        propDecorations[i].draw();
    }

    // 5. Draw Collectible Acorns
    for (let i = 0; i < acorns.length; i++) {
        acorns[i].draw();
    }

    // 6. Draw Scrolling Ground Tiles (tileset-based, upscaled 3x)
    // Sourced tile from tileset.png at sx=384, sy=96 (16x16px tile)
    // Top Edge of tile starts at y=240, height is 48px upscaled, extending to y=288
    // Below that, a row of dirt tiles at sx=384, sy=112 extending to y=300
    const tileW = 16;
    const tileH = 16;
    const upscaledSize = 48; // 16x3
    
    // We draw slightly past width to cover scrolling seam
    const numTiles = Math.ceil(CANVAS_WIDTH / upscaledSize) + 2; 

    for (let i = 0; i < numTiles; i++) {
        const dx = groundScrollX + (i * upscaledSize);
        
        // Row 1: Grass Surface Tile (sx=384, sy=96)
        ctx.drawImage(assets.tileset, 384, 96, tileW, tileH, dx, GROUND_Y, upscaledSize, upscaledSize);
        
        // Row 2: Dirt Subsurface Tile (sx=384, sy=112)
        ctx.drawImage(assets.tileset, 384, 112, tileW, tileH, dx, GROUND_Y + upscaledSize, upscaledSize, upscaledSize);
    }

    // 7. Draw Enemies
    for (let i = 0; i < enemies.length; i++) {
        enemies[i].draw();
    }

    // 8. Draw Player
    player.draw();

    // 9. HUD is now drawn via absolute HTML/CSS overlay (hud-overlay)

    // 9b. Stage specific environment overlays
    if (currentState === STATES.PLAYING || currentState === STATES.DEATH_ANIMATION || currentState === STATES.VICTORY) {
        if (currentStage === 2) {
            ctx.fillStyle = "rgba(10, 15, 60, 0.35)"; // Midnight Woods blue tint
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else if (currentStage === 3) {
            ctx.fillStyle = "rgba(255, 170, 0, 0.18)"; // Golden Woods amber tint
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
    }

    // 9c. Stage Banner Drawing
    if (stageBannerTimer > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(150, 110, 500, 60);
        ctx.strokeStyle = currentStage === 3 ? "#ffd700" : "#66fcf1";
        ctx.lineWidth = 3;
        ctx.strokeRect(150, 110, 500, 60);
        
        ctx.font = '20px "Press Start 2P"';
        ctx.fillStyle = currentStage === 3 ? "#ffd700" : "#66fcf1";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(stageBannerText, CANVAS_WIDTH / 2, 140);
    }

    // 10. Item Collection Screen Flash Effect
    if (flashTimer > 0) {
        ctx.fillStyle = `rgba(102, 252, 241, ${flashTimer * 0.04})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

// --- Main Engine Loop Controller ---
function gameLoop(now) {
    update(now);
    draw();
    requestAnimationFrame(gameLoop);
}

// --- Input Controllers ---

// Triggers jump or restart based on game state
function handleActionInput() {
    initAudio(); // Initialize audio context on first interaction

    if (currentState === STATES.START_SCREEN) {
        // Start Game
        document.getElementById('startOverlay').classList.add('overlay-hidden');
        currentState = STATES.PLAYING;
        const statusEl = document.getElementById('arcadeStatusText');
        if (statusEl) statusEl.innerText = 'RUNNING...';
        resetGame();
    } else if (currentState === STATES.PLAYING) {
        // Jump
        player.jump();
    } else if (currentState === STATES.GAME_OVER) {
        // Restart Game
        document.getElementById('gameOverOverlay').classList.add('overlay-hidden');
        currentState = STATES.PLAYING;
        const statusEl = document.getElementById('arcadeStatusText');
        if (statusEl) statusEl.innerText = 'RUNNING...';
        resetGame();
    } else if (currentState === STATES.VICTORY) {
        // Restart Game from Victory Screen
        document.getElementById('victoryOverlay').classList.add('overlay-hidden');
        currentState = STATES.PLAYING;
        const statusEl = document.getElementById('arcadeStatusText');
        if (statusEl) statusEl.innerText = 'RUNNING...';
        resetGame();
    }
}

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault(); // Stop page scrolling
        handleActionInput();
    }
});

// Click / Tap Listeners (Supports mobile/clicks)
canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleActionInput();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleActionInput();
}, { passive: false });

// Start Overlay Click / Tap to Start
document.getElementById('startOverlay').addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleActionInput();
});

document.getElementById('startOverlay').addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleActionInput();
}, { passive: false });

// Game Over Screen Action Button Listeners (Robust click + touch tap-through safety)
function handleRestartBtn(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    initAudio();
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    if (gameOverOverlay) {
        gameOverOverlay.classList.add('overlay-hidden');
    }
    currentState = STATES.PLAYING;
    resetGame();
}

function handleHomeBtn(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    initAudio();
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    if (gameOverOverlay) {
        gameOverOverlay.classList.add('overlay-hidden');
    }
    const startOverlay = document.getElementById('startOverlay');
    if (startOverlay) {
        startOverlay.classList.remove('overlay-hidden');
    }
    currentState = STATES.START_SCREEN;
    stopMusic();
}

const restartBtn = document.getElementById('restartBtn');
if (restartBtn) {
    restartBtn.addEventListener('click', handleRestartBtn);
    restartBtn.addEventListener('touchstart', handleRestartBtn, { passive: false });
}

const homeBtn = document.getElementById('homeBtn');
if (homeBtn) {
    homeBtn.addEventListener('click', handleHomeBtn);
    homeBtn.addEventListener('touchstart', handleHomeBtn, { passive: false });
}

// Victory Screen Action Button Listeners
function handleVictoryRestartBtn(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    initAudio();
    const victoryOverlay = document.getElementById('victoryOverlay');
    if (victoryOverlay) {
        victoryOverlay.classList.add('overlay-hidden');
    }
    currentState = STATES.PLAYING;
    resetGame();
}

function handleVictoryHomeBtn(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    initAudio();
    const victoryOverlay = document.getElementById('victoryOverlay');
    if (victoryOverlay) {
        victoryOverlay.classList.add('overlay-hidden');
    }
    const startOverlay = document.getElementById('startOverlay');
    if (startOverlay) {
        startOverlay.classList.remove('overlay-hidden');
    }
    currentState = STATES.START_SCREEN;
    stopMusic();
}

const victoryRestartBtn = document.getElementById('victoryRestartBtn');
if (victoryRestartBtn) {
    victoryRestartBtn.addEventListener('click', handleVictoryRestartBtn);
    victoryRestartBtn.addEventListener('touchstart', handleVictoryRestartBtn, { passive: false });
}

const victoryHomeBtn = document.getElementById('victoryHomeBtn');
if (victoryHomeBtn) {
    victoryHomeBtn.addEventListener('click', handleVictoryHomeBtn);
    victoryHomeBtn.addEventListener('touchstart', handleVictoryHomeBtn, { passive: false });
}

// Start the loop
requestAnimationFrame(gameLoop);
