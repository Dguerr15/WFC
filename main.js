import { 
    TILE_WIDTH, 
    TILE_HEIGHT, 
    MAP_WIDTH, 
    MAP_HEIGHT, 
    GAME_WIDTH, 
    GAME_HEIGHT, 
    TILES, 
    TILE_IDS, 
    INITIAL_POSSIBILITIES, 
    TILE_RULES 
} from './gameConfig.js';

// --- Global Variables ---
let grid;
let scene;
let graphics;
let wfcLoopTimer; // To store the Phaser event timer

// --- Core WFC Functions ---

/**
 * Finds the cell with the minimum entropy (fewest possibilities > 1) and collapses it.
 * @returns {object|string} The coordinates {x, y} of the collapsed cell, or 'FINISHED'/'CONTRADICTION'.
 */
function observe() {
    let minEntropy = Infinity;
    let candidates = [];
    let uncollapsedCount = 0;

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const possibilities = grid[y][x];
            const entropy = possibilities.length;
            
            if (entropy > 1) {
                uncollapsedCount++;
                if (entropy < minEntropy) {
                    minEntropy = entropy;
                    candidates = [{ x, y }];
                } else if (entropy === minEntropy) {
                    candidates.push({ x, y });
                }
            } else if (entropy === 0) {
                // Contradiction detected!
                return 'CONTRADICTION';
            }
        }
    }

    if (uncollapsedCount === 0) {
        // Map generation finished!
        return 'FINISHED';
    }

    // Select one cell randomly from the minimum entropy candidates
    const targetCell = Phaser.Math.RND.pick(candidates);

    // Collapse the cell by picking one tile randomly from its possibilities
    const chosenTileId = Phaser.Math.RND.pick(grid[targetCell.y][targetCell.x]);
    grid[targetCell.y][targetCell.x] = [chosenTileId];
    return targetCell;
}

/**
 * Core propagation step: Enforces constraints and cascades reductions using a queue.
 * @param {number} sx - Source X coordinate of the newly collapsed cell.
 * @param {number} sy - Source Y coordinate of the newly collapsed cell.
 * @returns {boolean} True if no contradiction, false if contradiction found.
 */
function propagate(sx, sy) {
    // Initialize the queue with the source cell that was just collapsed/reduced.
    const queue = [{ x: sx, y: sy }];

    // Directions: [dx, dy, sourceDirection] - sourceDir is the face of the source tile
    // that is sending the constraint (e.g., sourceDir='N' means the constraint travels North).
    const neighborDirections = [
        [0, -1, 'N'], // Propagate North
        [1, 0, 'E'],  // Propagate East
        [0, 1, 'S'],  // Propagate South
        [-1, 0, 'W']  // Propagate West
    ];
    
    // Define the reciprocal mapping for the second part of the symmetry check.
    const reciprocalMap = { 'N': 'S', 'E': 'W', 'S': 'N', 'W': 'E' }; // <-- NEW!
    
    // While there are cells whose reduced possibilities need to be propagated
    while (queue.length > 0) {
        // Pop the current cell from the queue
        const { x: cx, y: cy } = queue.pop(); 
        const sourcePossibilities = grid[cy][cx];
        
        for (const [dx, dy, sourceDir] of neighborDirections) {
            const nx = cx + dx;
            const ny = cy + dy;

            // Boundary check
            if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) {
                continue;
            }

            const neighborPossibilities = grid[ny][nx];

            // Only propagate if the neighbor is still uncollapsed
            if (neighborPossibilities.length <= 1) {
                continue;
            }
            
            // 1. Determine the allowed set of tiles for the neighbor (nx, ny).
            // A tile is allowed at (nx, ny) if it is compatible with *at least one*
            // tile in the current possibilities of the source cell (cx, cy).
            const allowedPossibilities = new Set();
            const reciprocalDir = reciprocalMap[sourceDir]; // <-- NEW!

            // Iterate over all possibilities in the source cell (cx, cy)
            for (const sId of sourcePossibilities) {
                const sourceRules = TILE_RULES[sId];
                
                // The constraint from sId on the neighbor is given by the source's rule in the sourceDir direction
                const requiredBySource = sourceRules[sourceDir]; 
                
                // Add all tiles compatible with the source (sId) to the allowed set
                for (const allowedId of requiredBySource) {
                    // *** CRITICAL RECIPROCITY CHECK ADDED HERE *** // <-- NEW LOGIC
                    
                    const neighborRules = TILE_RULES[allowedId];
                    const requiredByNeighbor = neighborRules[reciprocalDir];

                    // Check if the neighbor tile (allowedId) allows the source tile (sId) 
                    // on its reciprocal face. This enforces true symmetry.
                    if (requiredByNeighbor && requiredByNeighbor.includes(sId)) {
                        allowedPossibilities.add(allowedId);
                    }
                }
            }
            
            // Convert Set to Array
            const allowedPossibilitiesArray = Array.from(allowedPossibilities);

            // 2. Filter Neighbor's Possibilities (Intersection)
            const newPossibilities = neighborPossibilities.filter(neighborTileId => {
                // Check if the current neighborTileId is in the set of tiles allowed 
                // by the *current* possibilities of the source cell.
                return allowedPossibilitiesArray.includes(neighborTileId);
            });
            
            // 3. Update and Check
            if (newPossibilities.length < neighborPossibilities.length) {
                // State reduced, update grid
                grid[ny][nx] = newPossibilities;

                // Add the reduced cell to the queue to propagate its new, stricter state
                queue.push({ x: nx, y: ny });
            } 
            
            if (newPossibilities.length === 0) {
                // Contradiction!
                console.error(`Contradiction at (${nx}, ${ny}). No tile can satisfy constraints.`);
                return false;
            }
        }
    }
    return true;
}

/**
 * Runs one complete step of the WFC algorithm (Observe then Propagate).
 * @returns {string} Status ('CONTINUE', 'FINISHED', or 'CONTRADICTION').
 */
function runSingleWFCStep() {
    const observationResult = observe();

    if (typeof observationResult === 'string') {
        // 'FINISHED' or 'CONTRADICTION'
        return observationResult;
    }

    // Run the full cascading propagation
    const { x: sx, y: sy } = observationResult;
    const noContradiction = propagate(sx, sy);

    if (!noContradiction) {
        return 'CONTRADICTION';
    }
    
    // Successfully collapsed and propagated one step
    return 'CONTINUE';
}

/**
 * Phaser-based loop to run the WFC step-by-step for visualization.
 */



/**
 * Calculates the total entropy (sum of possibility counts) remaining in the grid.
 */
function getGridEntropy() {
    let entropy = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            entropy += grid[y][x].length;
        }
    }
    return entropy;
}

// --- Rendering and Game Setup ---

/**
 * Clears and draws the current state of the WFC grid to the Phaser canvas.
 */
function drawGrid() {
    // graphics is used for drawing the uncollapsed entropy state
    graphics.clear(); 

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const possibilities = grid[y][x];
            const count = possibilities.length;
            const px = x * TILE_WIDTH;
            const py = y * TILE_HEIGHT;

            if (count === 1) {
                // Collapsed tile: Use the loaded image
                const tileId = possibilities[0];
                const tileData = Object.values(TILES).find(t => t.id === tileId);
                const assetKey = tileData.assetKey;
                
                // Draw the image/sprite
                if (scene.tiles[y][x]) {
                    scene.tiles[y][x].setTexture(assetKey);
                    scene.tiles[y][x].setVisible(true);
                }

                // Draw a solid background color to mask any previous entropy visualization
                graphics.fillStyle(0x1f2937); 
                graphics.fillRect(px, py, TILE_WIDTH, TILE_HEIGHT);

            } else {
                // Uncollapsed tile: color based on entropy (Visualization only)
                const entropyRatio = Math.min(1, count / INITIAL_POSSIBILITIES.length);
                const colorValue = Phaser.Display.Color.Interpolate.ColorWithColor(
                    new Phaser.Display.Color(0x374151), // Dark gray (initial)
                    new Phaser.Display.Color(0x7c7c7c), // Lighter gray (low entropy)
                    1, 
                    1 - entropyRatio
                );
                graphics.fillStyle(colorValue.color);
                graphics.fillRect(px, py, TILE_WIDTH, TILE_HEIGHT);
                
                // Hide any existing tile sprite here if using layered rendering
                if (scene.tiles[y][x]) {
                    scene.tiles[y][x].setVisible(false);
                }
            }
        }
    }
}

/**
 * Initializes or resets the grid, setting all cells to max entropy (all possible tiles).
 */
function initializeGrid() {
    grid = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        grid[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            // All tiles are initially possible for every cell
            grid[y][x] = [...INITIAL_POSSIBILITIES];
        }
    }
    
    // Update status and draw the seed
    scene.statusText.setText(`Status: Forced Seed (Water, E-Edge, S-Edge). Starting WFC...`);
    drawGrid();
}
// ...existing code...

function wfcLoop() {
    if (!scene) return;
    // only run when in RUNNING state
    if (scene.wfcStatus !== 'RUNNING') return;

    try {
        const result = runSingleWFCStep();
        drawGrid();


    if (result === 'FINISHED') {
            scene.wfcStatus = 'FINISHED';
            scene.statusText.setText('Status: Generation COMPLETE!');
            if (wfcLoopTimer) wfcLoopTimer.paused = true;
            // optional post-processing (trees, etc)
            if (typeof placeTrees === 'function') placeTrees({ density: 0.08 });
            console.log('WFC: finished successfully.');
            return;
        }

        if (result === 'CONTRADICTION') {
            console.warn('WFC: contradiction detected. Will restart generation.');
            scene.wfcStatus = 'CONTRADICTION';
            scene.statusText.setText('Status: CONTRADICTION — restarting...');
            if (wfcLoopTimer) wfcLoopTimer.paused = true;
            // auto-restart after short delay so you can see the message
            setTimeout(() => {
                if (scene && typeof scene.resetAndStart === 'function') {
                    scene.resetAndStart();
                }
            }, 400);
            return;
        }

        // still running
        scene.statusText.setText(`Status: Running... Entropy: ${getGridEntropy()}`);
    } catch (err) {
        console.error('WFC loop threw an error:', err);
        // pause to avoid busy error loop; allow manual restart or auto-restart if desired
        if (wfcLoopTimer) wfcLoopTimer.paused = true;
        scene.statusText.setText('Status: Error — check console');
    }
}

function isLandTileAt(x, y) {
    // Only place trees on collapsed tiles (one possibility) and where the rendered sprite looks like dirt/land.
    if (!scene || !scene.tiles || !scene.tiles[y] || !scene.tiles[y][x]) return false;
    const sprite = scene.tiles[y][x];
    if (!sprite.visible) return false; // not drawn yet
    const key = (sprite.texture && sprite.texture.key) ? String(sprite.texture.key).toLowerCase() : '';

    // Common substrings that indicate a land/dirt tile in your assets.
    const LAND_KEY_SUBSTRINGS = ['dirt', 'land', 'soil', 'ground', 'maptile', 'map_tile', 'tile'];
    for (const sub of LAND_KEY_SUBSTRINGS) {
        if (key.includes(sub)) return true;
    }

    // fallback: if the cell is collapsed and not water-ish (you can add water substrings here)
    const possibilities = grid[y][x];
    if (Array.isArray(possibilities) && possibilities.length === 1) {
        // if you have a list of water IDs/names, check and return false for them:
        // const WATER_SUBSTRINGS = ['water','sea','ocean'];
        // if (WATER_SUBSTRINGS.some(w => key.includes(w))) return false;
        return true;
    }
    return false;
}

function placeTrees({ density = 0.05 } = {}) {
    if (!scene || !scene.treeGroup) return;
    // clear existing trees
    scene.treeGroup.clear(true, true);

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const possibilities = grid[y][x];
            if (!Array.isArray(possibilities) || possibilities.length !== 1) continue; // only on collapsed tiles

            if (!isLandTileAt(x, y)) continue;

            if (Math.random() < density) {
                const tx = x * TILE_WIDTH + TILE_WIDTH / 2;
                const ty = y * TILE_HEIGHT + TILE_HEIGHT / 2;
                const tree = scene.add.image(tx, ty, 'tree');
                tree.setOrigin(0.5);
                tree.setDepth(1); // above tiles
                tree.setScale(0.6 + Math.random() * 0.6);
                tree.setRotation((Math.random() - 0.5) * 0.25);
                // small random offset so trees don't look grid-aligned
                tree.x += (Math.random() - 0.5) * (TILE_WIDTH * 0.3);
                tree.y += (Math.random() - 0.5) * (TILE_HEIGHT * 0.2);
                scene.treeGroup.add(tree);
            }
        }
    }
}

// --- Phaser Scene ---
class WFCScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WFCScene' });
        this.wfcStatus = 'READY'; // READY, RUNNING, FINISHED, CONTRADICTION
        this.tiles = []; // Array to hold the tile images/sprites
        this.statusText = null; // Storing statusText on the scene instance
    }

    preload() {
        // --- CORRECTED LOCAL PATH FOR YOUR PNG FILES ---
        // This assumes your tile images are in a folder named 'TILES' 
        // relative to where the HTML/JS files are run (e.g., './TILES/mapTile_171.png').
        const baseUrl = './TILES/'; 
        
        Object.values(TILES).forEach(tile => {
            const path = `${baseUrl}${tile.assetKey}.png`;
            this.load.image(tile.assetKey, path);
            console.log(`Loading tile: ${tile.assetKey} from ${path}`);
        });
        this.load.image('tree', `${baseUrl}tree.png`);
        console.log(`enqueue tree load: tree <- ${baseUrl}tree.png`);

    // debug: report when each file finishes loading
    this.load.on('filecomplete', (key, type, data) => {
        console.log(`filecomplete: key=${key} type=${type}`);
    });

    // debug: report when the whole loader finishes
    this.load.on('complete', () => {
        console.log('loader complete. textures:', Object.keys(this.textures.list));
        console.log('tree texture exists?', this.textures.exists('tree'));
    });
    }

    create() {
        scene = this;
        this.cameras.main.setBackgroundColor('#1f2937');
        
        // Setup Graphics object for drawing the map (entropy visualization layer)
        graphics = this.add.graphics({ x: 0, y: 0 });

        // Initialize the sprite layer (used when a tile is collapsed)
        for (let y = 0; y < MAP_HEIGHT; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                // Create a placeholder sprite for every cell
                const sprite = this.add.sprite(
                    x * TILE_WIDTH + TILE_WIDTH / 2, 
                    y * TILE_HEIGHT + TILE_HEIGHT / 2, 
                    Object.values(TILES)[0].assetKey // Use the first tile as a placeholder texture
                );
                sprite.setOrigin(0.5); // Center the sprite
                sprite.setVisible(false);
                this.tiles[y][x] = sprite;
            }
        }
        // Tree group (decorative overlay)
        this.treeGroup = this.add.group();

        // Setup Status Text (Top Left)
        this.statusText = this.add.text(10, 10, 'Status: Initializing...', { 
            fontFamily: 'Inter', 
            fontSize: '16px', 
            color: '#ffffff' 
        });
        this.statusText.setDepth(1); 
        
        // Setup the continuous WFC loop timer
        wfcLoopTimer = this.time.addEvent({
            delay: 50, // 50ms delay for a visible step-by-step process (20 steps per second)
            callback: wfcLoop,
            callbackScope: this,
            loop: true,
            paused: true // Start paused
        });

        // Start the first generation immediately
        this.resetAndStart();
        
        // --- Input Handling ---
        
        // R key listener for Regeneration
        this.input.keyboard.on('keydown-R', () => {
            this.resetAndStart();
        });
    }
    
    resetAndStart() {
        // Stop any previous generation loop
        if (wfcLoopTimer) {
            wfcLoopTimer.paused = true;
        }

        this.wfcStatus = 'RUNNING';
        initializeGrid();
        
        // Resume the step-by-step loop
        wfcLoopTimer.paused = false;

        // Clear any previously placed trees
        if (this.treeGroup) {
            this.treeGroup.clear(true, true);
        }
    }
}

// --- Phaser Game Configuration ---
const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'phaser-game', // ID of the div in index.html
    scene: WFCScene,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    input: {
        keyboard: true
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

window.addEventListener('load', () => {
    // Start the game on window load.
    new Phaser.Game(config);
});