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
    // We wait for window onload usually, or assume loaded if in DOM
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

    // Composite operation to tint
    // 'source-atop' keeps the new drawing (color) only where the existing drawing (img) is opaque
    // OR 'multiply' to darken
    // Simple hue tinting: fill a semi-transparent rect
    bCtx.globalCompositeOperation = 'source-atop';
    bCtx.fillStyle = color;
    bCtx.fillRect(0, 0, BLOCK_SIZE, BLOCK_SIZE);
    
    // Add a bit of original texture back if needed, or just use multiply
    // Let's try 'multiply' over the original
    bCtx.globalCompositeOperation = 'multiply';
    bCtx.drawImage(img, 0, 0, BLOCK_SIZE, BLOCK_SIZE); // Draw again to add texture shading? 
    // Actually source-atop with solid color makes it flat silhouette. 
    // Better approach: 
    // 1. Draw image
    // 2. Set globalCompositeOperation = 'multiply'
    // 3. Fill color rect
    // 4. Set globalCompositeOperation = 'destination-in' to clip to alpha (not needed if image has transp)
    
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // clearer logic handled in css, but need clear
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Standard clear

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
                // Determine color/texture
                const pieceType = typeOverride || INDEX_TO_PIECE[value];
                const img = tintedBlocks[pieceType];
                if (img) {
                    context.drawImage(img, 
                        (x + offset.x) * BLOCK_SIZE, 
                        (y + offset.y) * BLOCK_SIZE, 
                        BLOCK_SIZE, BLOCK_SIZE);
                } else {
                    // Fallback
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
    ghost.pos.y--; // Back up one step

    // Draw ghost with low opacity
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
    
    // Get next piece
    const type = nextPieces.shift();
    player.matrix = SHAPES[type];
    player.currPieceType = type;
    
    // Set numeric value in matrix locally for merge
    // Actually SHAPES has numeric values already from definition? 
    // Oops, I defined SHAPES with values 1,2,3... above?
    // Let's re-verify. Yes SHAPES values are 1,2,3... but defined cleanly?
    // No, I defined them with actual numbers: [0,1,0,0] etc.
    // Yes.
    
    // Position
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) -
                   (player.matrix[0].length / 2 | 0);

    // Check game over
    if (collide(arena, player)) {
        isGameOver = true;
        isGameRunning = false;
        isPaused = false;
        modalGameOver.classList.remove('hidden');
        finalScoreElement.innerText = player.score;
    }

    canHold = true;
    fillNextPieces(); // Ensure buffer has pieces
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
    // If holding logic
    if (holdPiece) {
        // Swap
        const temp = holdPiece;
        holdPiece = currentType;
        player.currPieceType = temp;
        player.matrix = SHAPES[temp];
        // Reset position
        player.pos.y = 0;
        player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    } else {
        holdPiece = currentType;
        playerReset(); // Get next piece since we just held current
        // Wait, playerReset pops next piece. Correct.
    }
    
    canHold = false;
    drawHold();
}

function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    // Draw next 3 pieces
    nextPieces.slice(0, 3).forEach((type, index) => {
        const matrix = SHAPES[type];
        // Centering logic approx
        const offsetX = (nextCanvas.width/BLOCK_SIZE - matrix[0].length) / 2; // rough
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
    // Smaller block size for aux ? Or scale context?
    // 100x100 canvas. Block 30. 3 blocks fits.
    // Let's use 20px blocks for aux?
    // Or just scale the context at init.
    // Let's stick to 25px effective.
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
        // Scoring: 100, 300, 500, 800
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
    modalStart.style.display = 'none'; // Use display none/block or class
    modalStart.classList.add('hidden');
    modalGameOver.classList.add('hidden');
    
    fillNextPieces();
    playerReset();
    update();
}

// Controls
document.addEventListener('keydown', event => {
    if (isGameOver) return;
    
    if (event.key === 'p' || event.key === 'P') {
        if (!isGameRunning && !isGameOver) return; // Not started yet
        isPaused = !isPaused;
        if (isPaused) {
            modalPause.classList.remove('hidden');
        } else {
            modalPause.classList.add('hidden');
            lastTime = performance.now();
            update(lastTime);
        }
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

// Init
window.addEventListener('load', () => {
    initAssets();
});
