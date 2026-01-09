const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const finalScoreElement = document.getElementById('final-score');

const modalStart = document.getElementById('start-modal');
const modalGameOver = document.getElementById('game-over-modal');
const modalPause = document.getElementById('pause-modal');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const resumeBtn = document.getElementById('resume-btn');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // 300 / 10

// Scale hold/next
holdCtx.scale(1, 1);
nextCtx.scale(1, 1);

// Tetromino definitions
const PIECES = 'ILJOTSZ';
const COLORS = {
    'I': '#00f0f0', // Cyan
    'O': '#f0f000', // Yellow
    'T': '#a000f0', // Purple
    'S': '#00f000', // Green
    'Z': '#f00000', // Red
    'J': '#0000f0', // Blue
    'L': '#f0a000'  // Orange
};

const SHAPES = {
    'I': [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
    ],
    'L': [
        [0, 2, 0],
        [0, 2, 0],
        [0, 2, 2],
    ],
    'J': [
        [0, 3, 0],
        [0, 3, 0],
        [3, 3, 0],
    ],
    'O': [
        [4, 4],
        [4, 4],
    ],
    'Z': [
        [5, 5, 0],
        [0, 5, 5],
        [0, 0, 0],
    ],
    'S': [
        [0, 6, 6],
        [6, 6, 0],
        [0, 0, 0],
    ],
    'T': [
        [0, 7, 0],
        [7, 7, 7],
        [0, 0, 0],
    ]
};

// Map number to Piece char
const INDEX_TO_PIECE = [null, 'I', 'L', 'J', 'O', 'Z', 'S', 'T'];

// Game State
let arena = createMatrix(COLS, ROWS);
let player = {
    pos: {x: 0, y: 0},
    matrix: null,
    score: 0,
    level: 1,
    lines: 0,
    currPieceType: null,
};
let holdPiece = null;
let canHold = true;
let nextPieces = [];
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isPaused = false;
let isGameOver = false;
let isGameRunning = false;

// Assets
const blockImg = document.getElementById('asset-block');
const tintedBlocks = {};

function initAssets() {
    // Generate tinted versions of block.png for each piece color
    const types = ['I', 'L', 'J', 'O', 'Z', 'S', 'T'];
    
    types.forEach(type => {
        const color = COLORS[type];
        tintedBlocks[type] = createTintedBlock(blockImg, color);
    });
}

function createTintedBlock(img, color) {
    const buffer = document.createElement('canvas');
    buffer.width = BLOCK_SIZE;
    buffer.height = BLOCK_SIZE;
    const bCtx = buffer.getContext('2d');

    // Draw image
    bCtx.drawImage(img, 0, 0, BLOCK_SIZE, BLOCK_SIZE);

    // Reset to do it properly:
    bCtx.globalCompositeOperation = 'source-over';
    bCtx.clearRect(0,0,BLOCK_SIZE, BLOCK_SIZE);
    bCtx.drawImage(img, 0, 0, BLOCK_SIZE, BLOCK_SIZE);
    
    bCtx.globalCompositeOperation = 'multiply';
    bCtx.fillStyle = color;
    bCtx.fillRect(0, 0, BLOCK_SIZE, BLOCK_SIZE);

    // To ensure alpha is preserved correctly
    bCtx.globalCompositeOperation = 'destination-in';
    bCtx.drawImage(img, 0, 0, BLOCK_SIZE, BLOCK_SIZE);
    
    return buffer;
}


function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function draw() {
    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Arena
    drawMatrix(arena, {x: 0, y: 0}, ctx);

    // Draw Ghost Piece
    drawGhost();

    // Draw Player
    drawMatrix(player.matrix, player.pos, ctx, player.currPieceType);
}

function drawMatrix(matrix, offset, context, typeOverride = null) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const pieceType = typeOverride || INDEX_TO_PIECE[value];
                const img = tintedBlocks[pieceType];
                if (img) {
                    context.drawImage(img, 
                        (x + offset.x) * BLOCK_SIZE, 
                        (y + offset.y) * BLOCK_SIZE, 
                        BLOCK_SIZE, BLOCK_SIZE);
                } else {
                    context.fillStyle = COLORS[pieceType] || 'white';
                    context.fillRect((x + offset.x) * BLOCK_SIZE,
                                     (y + offset.y) * BLOCK_SIZE,
                                     BLOCK_SIZE, BLOCK_SIZE);
                }
            }
        });
    });
}

function drawGhost() {
    if(!player.matrix) return;
    
    const ghost = {
        pos: {...player.pos},
        matrix: player.matrix
    };

    while (!collide(arena, ghost)) {
        ghost.pos.y++;
    }
    ghost.pos.y--;

    ghost.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
               ctx.globalAlpha = 0.3;
               const pieceType = player.currPieceType;
               const img = tintedBlocks[pieceType];
               if(img) {
                   ctx.drawImage(img, 
                        (x + ghost.pos.x) * BLOCK_SIZE, 
                        (y + ghost.pos.y) * BLOCK_SIZE, 
                        BLOCK_SIZE, BLOCK_SIZE);
               }
               ctx.globalAlpha = 1.0;
            }
        });
    });
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                matrix[y][x],
                matrix[x][y],
            ];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(arena, player);
    playerReset();
    arenaSweep();
    updateScore();
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function playerReset() {
    if (nextPieces.length === 0) fillNextPieces();
    
    const type = nextPieces.shift();
    player.matrix = SHAPES[type];
    player.currPieceType = type;
    
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) -
                   (player.matrix[0].length / 2 | 0);

    if (collide(arena, player)) {
        isGameOver = true;
        isGameRunning = false;
        isPaused = false;
        modalGameOver.classList.remove('hidden');
        finalScoreElement.innerText = player.score;
    }

    canHold = true;
    fillNextPieces();
    drawNext();
    drawHold();
}

function fillNextPieces() {
    while(nextPieces.length < 4) {
        const pieces = 'ILJOTSZ';
        nextPieces.push(pieces[pieces.length * Math.random() | 0]);
    }
}

function hold() {
    if (!canHold) return;
    
    const currentType = player.currPieceType;
    if (holdPiece) {
        const temp = holdPiece;
        holdPiece = currentType;
        player.currPieceType = temp;
        player.matrix = SHAPES[temp];
        player.pos.y = 0;
        player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    } else {
        holdPiece = currentType;
        playerReset();
    }
    
    canHold = false;
    drawHold();
}

function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextPieces.slice(0, 3).forEach((type, index) => {
        const matrix = SHAPES[type];
        const offsetX = (nextCanvas.width/BLOCK_SIZE - matrix[0].length) / 2;
        const offsetY = 1 + index * 4;
        
        drawAuxMatrix(matrix, {x: 1, y: offsetY}, nextCtx, type);
    });
}

function drawHold() {
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (holdPiece) {
        const matrix = SHAPES[holdPiece];
        drawAuxMatrix(matrix, {x: 0.5, y: 0.5}, holdCtx, holdPiece);
    }
}

function drawAuxMatrix(matrix, offset, context, type) {
    const AUX_BLOCK = 25;
    
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const img = tintedBlocks[type];
                if (img) {
                    context.drawImage(img, 
                        (x + offset.x) * AUX_BLOCK, 
                        (y + offset.y) * AUX_BLOCK, 
                        AUX_BLOCK, AUX_BLOCK);
                }
            }
        });
    });
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }

        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        rowCount++;
    }
    
    if (rowCount > 0) {
        const lineScores = [0, 100, 300, 500, 800];
        player.score += lineScores[rowCount] * player.level;
        player.lines += rowCount;
        player.level = Math.floor(player.lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (player.level - 1) * 100);
    }
}

function updateScore() {
    scoreElement.innerText = player.score;
    levelElement.innerText = player.level;
    linesElement.innerText = player.lines;
}

function update(time = 0) {
    if (!isGameRunning || isPaused) return;

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestAnimationFrame(update);
}

function startGame() {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    player.lines = 0;
    player.level = 1;
    dropInterval = 1000;
    nextPieces = [];
    holdPiece = null;
    updateScore();
    isGameOver = false;
    isGameRunning = true;
    isPaused = false;
    modalStart.style.display = 'none';
    modalStart.classList.add('hidden');
    modalGameOver.classList.add('hidden');
    
    fillNextPieces();
    playerReset();
    update();
}

function togglePause() {
    if (!isGameRunning && !isGameOver) return;
    if (isGameOver) return;
    
    isPaused = !isPaused;
    if (isPaused) {
        modalPause.classList.remove('hidden');
    } else {
        modalPause.classList.add('hidden');
        lastTime = performance.now();
        update(lastTime);
    }
}

// ========================================
// Keyboard Controls
// ========================================
document.addEventListener('keydown', event => {
    if (isGameOver) return;
    
    if (event.key === 'p' || event.key === 'P') {
        togglePause();
        return;
    }

    if (!isGameRunning || isPaused) return;

    if (event.code === 'ArrowLeft') {
        playerMove(-1);
    } else if (event.code === 'ArrowRight') {
        playerMove(1);
    } else if (event.code === 'ArrowDown') {
        playerDrop();
    } else if (event.code === 'ArrowUp') {
        playerRotate(1);
    } else if (event.code === 'Space') {
        playerHardDrop();
    } else if (event.code === 'KeyC') {
        hold();
    }
});

startBtn.addEventListener('click', () => {
    startGame();
    lastTime = performance.now();
    update();
});

restartBtn.addEventListener('click', () => {
    startGame();
    lastTime = performance.now();
    update();
});

resumeBtn.addEventListener('click', () => {
    isPaused = false;
    modalPause.classList.add('hidden');
    lastTime = performance.now();
    update(lastTime);
});

// ========================================
// Mobile Touch Controls
// ========================================

// Touch control buttons
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnDown = document.getElementById('btn-down');
const btnRotate = document.getElementById('btn-rotate');
const btnHardDrop = document.getElementById('btn-hard-drop');
const btnHold = document.getElementById('btn-hold');
const btnPause = document.getElementById('btn-pause');

// Prevent default touch behavior to avoid scrolling
function preventTouchDefault(e) {
    e.preventDefault();
}

// Add visual feedback for button press
function addButtonFeedback(btn) {
    btn.classList.add('active');
}

function removeButtonFeedback(btn) {
    btn.classList.remove('active');
}

// Auto-repeat for movement buttons
let moveInterval = null;
let moveDirection = 0;

function startAutoMove(dir) {
    if (!isGameRunning || isPaused || isGameOver) return;
    
    moveDirection = dir;
    playerMove(dir);
    
    // Start auto-repeat after initial delay
    clearInterval(moveInterval);
    moveInterval = setInterval(() => {
        if (isGameRunning && !isPaused && !isGameOver) {
            playerMove(moveDirection);
        }
    }, 80); // Repeat rate
}

function stopAutoMove() {
    clearInterval(moveInterval);
    moveInterval = null;
}

// Auto-repeat for soft drop
let softDropInterval = null;

function startSoftDrop() {
    if (!isGameRunning || isPaused || isGameOver) return;
    
    playerDrop();
    
    clearInterval(softDropInterval);
    softDropInterval = setInterval(() => {
        if (isGameRunning && !isPaused && !isGameOver) {
            playerDrop();
        }
    }, 50); // Fast drop rate
}

function stopSoftDrop() {
    clearInterval(softDropInterval);
    softDropInterval = null;
}

// Setup touch event listeners for each button
if (btnLeft) {
    btnLeft.addEventListener('touchstart', (e) => {
        preventTouchDefault(e);
        addButtonFeedback(btnLeft);
        startAutoMove(-1);
    }, { passive: false });
    
    btnLeft.addEventListener('touchend', (e) => {
        preventTouchDefault(e);
        removeButtonFeedback(btnLeft);
        stopAutoMove();
    }, { passive: false });
    
    btnLeft.addEventListener('touchcancel', (e) => {
        removeButtonFeedback(btnLeft);
        stopAutoMove();
    });
}

if (btnRight) {
    btnRight.addEventListener('touchstart', (e) => {
        preventTouchDefault(e);
        addButtonFeedback(btnRight);
        startAutoMove(1);
    }, { passive: false });
    
    btnRight.addEventListener('touchend', (e) => {
        preventTouchDefault(e);
        removeButtonFeedback(btnRight);
        stopAutoMove();
    }, { passive: false });
    
    btnRight.addEventListener('touchcancel', (e) => {
        removeButtonFeedback(btnRight);
        stopAutoMove();
    });
}

if (btnDown) {
    btnDown.addEventListener('touchstart', (e) => {
        preventTouchDefault(e);
        addButtonFeedback(btnDown);
        startSoftDrop();
    }, { passive: false });
    
    btnDown.addEventListener('touchend', (e) => {
        preventTouchDefault(e);
        removeButtonFeedback(btnDown);
        stopSoftDrop();
    }, { passive: false });
    
    btnDown.addEventListener('touchcancel', (e) => {
        removeButtonFeedback(btnDown);
        stopSoftDrop();
    });
}

if (btnRotate) {
    btnRotate.addEventListener('touchstart', (e) => {
        preventTouchDefault(e);
        addButtonFeedback(btnRotate);
        if (isGameRunning && !isPaused && !isGameOver) {
            playerRotate(1);
        }
    }, { passive: false });
    
    btnRotate.addEventListener('touchend', (e) => {
        preventTouchDefault(e);
        removeButtonFeedback(btnRotate);
    }, { passive: false });
}

if (btnHardDrop) {
    btnHardDrop.addEventListener('touchstart', (e) => {
        preventTouchDefault(e);
        addButtonFeedback(btnHardDrop);
        if (isGameRunning && !isPaused && !isGameOver) {
            playerHardDrop();
        }
    }, { passive: false });
    
    btnHardDrop.addEventListener('touchend', (e) => {
        preventTouchDefault(e);
        removeButtonFeedback(btnHardDrop);
    }, { passive: false });
}

if (btnHold) {
    btnHold.addEventListener('touchstart', (e) => {
        preventTouchDefault(e);
        addButtonFeedback(btnHold);
        if (isGameRunning && !isPaused && !isGameOver) {
            hold();
        }
    }, { passive: false });
    
    btnHold.addEventListener('touchend', (e) => {
        preventTouchDefault(e);
        removeButtonFeedback(btnHold);
    }, { passive: false });
}

if (btnPause) {
    btnPause.addEventListener('touchstart', (e) => {
        preventTouchDefault(e);
        addButtonFeedback(btnPause);
        togglePause();
    }, { passive: false });
    
    btnPause.addEventListener('touchend', (e) => {
        preventTouchDefault(e);
        removeButtonFeedback(btnPause);
    }, { passive: false });
}

// ========================================
// Swipe Gesture Controls on Game Canvas
// ========================================

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
const SWIPE_THRESHOLD = 30;
const TAP_THRESHOLD = 10;
const TAP_TIME_THRESHOLD = 200;

canvas.addEventListener('touchstart', (e) => {
    if (!isGameRunning || isPaused || isGameOver) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    if (!isGameRunning || isPaused || isGameOver) return;
    
    e.preventDefault();
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Check if it's a tap (quick touch with minimal movement) -> Rotate
    if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD && deltaTime < TAP_TIME_THRESHOLD) {
        playerRotate(1);
        return;
    }
    
    // Swipe detection
    if (absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) {
        if (absX > absY) {
            // Horizontal swipe
            if (deltaX > 0) {
                playerMove(1); // Right
            } else {
                playerMove(-1); // Left
            }
        } else {
            // Vertical swipe
            if (deltaY > 0) {
                // Swipe down -> Hard drop
                playerHardDrop();
            }
            // Swipe up could be rotate, but we use tap for that
        }
    }
}, { passive: false });

// Prevent scrolling when touching the game area
document.querySelector('.game-wrapper').addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// ========================================
// Init
// ========================================
window.addEventListener('load', () => {
    initAssets();
    
    // Detect if touch device and show/hide controls accordingly
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.body.classList.add('touch-device');
    }
});
