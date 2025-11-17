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
    TILE_RULES,
    MUSHROOM_ASSET_KEY 
} from './gameConfig.js';

// Global Variables
let grid;
let scene;
let graphics;
let wfcLoopTimer;
let tilesWithTrees = []; 

// The ID for the DIRT_CENTER tile, used for precise placement of trees.
const DIRT_CENTER_ID = TILES.DIRT_CENTER.id;

// Core WFC Functions

// Finds the cell with the minimum entropy and collapses it.
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
                return 'CONTRADICTION';
            }
        }
    }

    if (uncollapsedCount === 0) {
        return 'FINISHED';
    }

    const targetCell = Phaser.Math.RND.pick(candidates);
    const chosenTileId = Phaser.Math.RND.pick(grid[targetCell.y][targetCell.x]);
    grid[targetCell.y][targetCell.x] = [chosenTileId];
    return targetCell;
}

// Core propagation step Enforces constraints and cascades reductions using a queue.
function propagate(sx, sy) {
    const queue = [{ x: sx, y: sy }];
    const neighborDirections = [
        [0, -1, 'N'], 
        [1, 0, 'E'],  
        [0, 1, 'S'],  
        [-1, 0, 'W'] 
    ];
    const reciprocalMap = { 'N': 'S', 'E': 'W', 'S': 'N', 'W': 'E' };
    
    while (queue.length > 0) {
        const { x: cx, y: cy } = queue.pop(); 
        const sourcePossibilities = grid[cy][cx];
        
        for (const [dx, dy, sourceDir] of neighborDirections) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) {
                continue;
            }

            const neighborPossibilities = grid[ny][nx];

            if (neighborPossibilities.length <= 1) {
                continue;
            }
            
            const allowedPossibilities = new Set();
            const reciprocalDir = reciprocalMap[sourceDir];

            // Iterate through the source tile possibilities and find compatible neighbor tiles
            for (const sId of sourcePossibilities) {
                const sourceRules = TILE_RULES[sId];
                const requiredBySource = sourceRules[sourceDir]; 
                
                for (const allowedId of requiredBySource) {
                    const neighborRules = TILE_RULES[allowedId];
                    const requiredByNeighbor = neighborRules[reciprocalDir];

                    if (requiredByNeighbor && requiredByNeighbor.includes(sId)) {
                        allowedPossibilities.add(allowedId);
                    }
                }
            }
            
            const allowedPossibilitiesArray = Array.from(allowedPossibilities);

            const newPossibilities = neighborPossibilities.filter(neighborTileId => {
                return allowedPossibilitiesArray.includes(neighborTileId);
            });
            
            if (newPossibilities.length < neighborPossibilities.length) {
                grid[ny][nx] = newPossibilities;
                queue.push({ x: nx, y: ny });
            } 
            
            if (newPossibilities.length === 0) {
                console.error(`Contradiction at (${nx}, ${ny}). No tile can satisfy constraints.`);
                return false;
            }
        }
    }
    return true;
}

// Runs one complete step of the WFC algorithm Observe then Propagate.
function runSingleWFCStep() {
    const observationResult = observe();

    if (typeof observationResult === 'string') {
        return observationResult;
    }

    const { x: sx, y: sy } = observationResult;
    const noContradiction = propagate(sx, sy);

    if (!noContradiction) {
        return 'CONTRADICTION';
    }
    
    return 'CONTINUE';
}

// Calculates the total entropy remaining in the grid.
function getGridEntropy() {
    let entropy = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            entropy += grid[y][x].length;
        }
    }
    return entropy;
}

// Rendering and Game Setup

// Clears and draws the current state of the WFC grid to the Phaser canvas.
function drawGrid() {
    graphics.clear(); 

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const possibilities = grid[y][x];
            const count = possibilities.length;
            const px = x * TILE_WIDTH;
            const py = y * TILE_HEIGHT;

            if (count === 1) {
                const tileId = possibilities[0];
                const tileData = Object.values(TILES).find(t => t.id === tileId);
                const assetKey = tileData.assetKey;
                
                if (scene.tiles[y][x]) {
                    scene.tiles[y][x].setTexture(assetKey);
                    scene.tiles[y][x].setVisible(true);
                }

                graphics.fillStyle(0x1f2937); 
                graphics.fillRect(px, py, TILE_WIDTH, TILE_HEIGHT);

            } else {
                // Visualize uncollapsed cells based on entropy
                const entropyRatio = Math.min(1, count / INITIAL_POSSIBILITIES.length);
                const colorValue = Phaser.Display.Color.Interpolate.ColorWithColor(
                    new Phaser.Display.Color(0x374151), 
                    new Phaser.Display.Color(0x7c7c7c), 
                    1, 
                    1 - entropyRatio
                );
                graphics.fillStyle(colorValue.color);
                graphics.fillRect(px, py, TILE_WIDTH, TILE_HEIGHT);
                
                if (scene.tiles[y][x]) {
                    scene.tiles[y][x].setVisible(false);
                }
            }
        }
    }
}

// Initializes or resets the grid setting all cells to max entropy.
function initializeGrid() {
    grid = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        grid[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            grid[y][x] = [...INITIAL_POSSIBILITIES];
        }
    }
    
    scene.statusText.setText(`Status: Forced Seed (Water, E-Edge, S-Edge). Starting WFC...`);
    drawGrid();
}

// Executes a single step of the WFC loop, handles results, and manages the timer.
function wfcLoop() {
    if (!scene || scene.wfcStatus !== 'RUNNING') return;

    try {
        const result = runSingleWFCStep();
        drawGrid();

        if (result === 'FINISHED') {
            scene.wfcStatus = 'FINISHED';
            scene.statusText.setText('Status: Generation COMPLETE!');
            if (wfcLoopTimer) wfcLoopTimer.paused = true;
            
            // Trees are placed first and their positions are recorded
            placeTrees({ density: 0.5 });
            
            // Mushrooms are placed second avoiding tree positions
            placeMushrooms({ density: 0.1 }); 
            
            console.log('WFC: finished successfully.');
            return;
        }

        if (result === 'CONTRADICTION') {
            console.warn('WFC: contradiction detected. Will restart generation.');
            scene.wfcStatus = 'CONTRADICTION';
            scene.statusText.setText('Status: CONTRADICTION — restarting...');
            if (wfcLoopTimer) wfcLoopTimer.paused = true;
            setTimeout(() => {
                if (scene && typeof scene.resetAndStart === 'function') {
                    scene.resetAndStart();
                }
            }, 400);
            return;
        }

        scene.statusText.setText(`Status: Running... Entropy: ${getGridEntropy()}`);
    } catch (err) {
        console.error('WFC loop threw an error:', err);
        if (wfcLoopTimer) wfcLoopTimer.paused = true;
        scene.statusText.setText('Status: Error — check console');
    }
}

// Checks if the specified grid cell is collapsed to the DIRT_CENTER tile ID.
function isDirtCenterTile(x, y) {
    const possibilities = grid[y][x];
    // Check if the cell is collapsed and if the single tile ID matches the DIRT_CENTER_ID (which is 1).
    return Array.isArray(possibilities) && 
           possibilities.length === 1 && 
           possibilities[0] === DIRT_CENTER_ID;
}

// Places 'tree' sprites randomly on tiles that are determined to be DIRT_CENTER.
function placeTrees({ density = 0.05 } = {}) {
    if (!scene || !scene.treeGroup) return;
    scene.treeGroup.clear(true, true);
    tilesWithTrees = []; // Reset tree positions list

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            
            if (!isDirtCenterTile(x, y)) continue;

            if (Math.random() < density) {
                // Record the tree's position
                tilesWithTrees.push(`${x},${y}`); 
                
                const tx = x * TILE_WIDTH + TILE_WIDTH / 2;
                const ty = y * TILE_HEIGHT + TILE_HEIGHT / 2;
                const tree = scene.add.image(tx, ty, 'tree');
                tree.setOrigin(0.5);
                tree.setDepth(1); 
                tree.setScale(0.6 + Math.random() * 0.6);
                scene.treeGroup.add(tree);
            }
        }
    }
}

// Places 'mushroom' sprites randomly on non-water tiles that do not contain a tree.
function placeMushrooms({ density = 0.1 } = {}) {
    if (!scene || !scene.mushroomGroup) return;
    // Clear existing mushrooms
    scene.mushroomGroup.clear(true, true); 
    const treePositions = new Set(tilesWithTrees); // Use a Set for fast lookup

    const WATER_ID = TILES.WATER.id; // Water ID is 0

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            
            // Check for existing tree at this cell
            if (treePositions.has(`${x},${y}`)) { 
                continue; 
            }
            
            const possibilities = grid[y][x];
            
            // Check if the cell is collapsed and if the single tile ID is NOT water
            const isNonWaterTile = Array.isArray(possibilities) && 
                                   possibilities.length === 1 && 
                                   possibilities[0] !== WATER_ID;

            if (!isNonWaterTile) continue;

            if (Math.random() < density) {
                const tx = x * TILE_WIDTH + TILE_WIDTH / 2;
                const ty = y * TILE_HEIGHT + TILE_HEIGHT / 2;
                const mushroom = scene.add.image(tx, ty, 'mushroom');
                mushroom.setOrigin(0.5);
                mushroom.setDepth(2); 
                mushroom.setScale(0.5 + Math.random() * 0.4);
                scene.mushroomGroup.add(mushroom);
            }
        }
    }
}

// Phaser Scene
// Main Phaser Scene class for managing the game state, assets, and WFC process.
class WFCScene extends Phaser.Scene {
    // Constructor initializes scene state variables.
    constructor() {
        super({ key: 'WFCScene' });
        this.wfcStatus = 'READY'; 
        this.tiles = []; 
        this.statusText = null; 
    }

    // Loads all required tile assets, tree, and mushroom assets.
    preload() {
        const baseUrl = './TILES/'; 
        
        Object.values(TILES).forEach(tile => {
            const path = `${baseUrl}${tile.assetKey}.png`;
            this.load.image(tile.assetKey, path);
        });
        this.load.image('tree', `${baseUrl}tree.png`);
        
        this.load.image('mushroom', `${baseUrl}${MUSHROOM_ASSET_KEY}.png`); 

        // Log asset loading status
        this.load.on('complete', () => {
            console.log('loader complete. textures:', Object.keys(this.textures.list));
        });
    }

    // Creates the scene's objects, initializes the grid, and sets up input/timers.
    create() {
        scene = this;
        this.cameras.main.setBackgroundColor('#1f2937');
        
        graphics = this.add.graphics({ x: 0, y: 0 });

        for (let y = 0; y < MAP_HEIGHT; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                const sprite = this.add.sprite(
                    x * TILE_WIDTH + TILE_WIDTH / 2, 
                    y * TILE_HEIGHT + TILE_HEIGHT / 2, 
                    Object.values(TILES)[0].assetKey 
                );
                sprite.setOrigin(0.5); 
                sprite.setVisible(false);
                this.tiles[y][x] = sprite;
            }
        }
        this.treeGroup = this.add.group();
        this.mushroomGroup = this.add.group();

        this.statusText = this.add.text(10, 10, 'Status: Initializing...', { 
            fontFamily: 'Inter', 
            fontSize: '16px', 
            color: '#ffffff' 
        });
        this.statusText.setDepth(1); 
        
        wfcLoopTimer = this.time.addEvent({
            delay: 50, 
            callback: wfcLoop,
            callbackScope: this,
            loop: true,
            paused: true 
        });

        this.resetAndStart();
        
        this.input.keyboard.on('keydown-R', () => {
            this.resetAndStart();
        });
    }
    
    // Resets the WFC grid and starts a new generation loop.
    resetAndStart() {
        if (wfcLoopTimer) {
            wfcLoopTimer.paused = true;
        }

        this.wfcStatus = 'RUNNING';
        initializeGrid();
        
        // Reset the list of tree positions
        tilesWithTrees = []; 
        
        wfcLoopTimer.paused = false;

        if (this.treeGroup) {
            this.treeGroup.clear(true, true);
        }
        if (this.mushroomGroup) {
            this.mushroomGroup.clear(true, true);
        }
    }
}

// Phaser Game Configuration
// Configuration object for the Phaser game instance.
const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'phaser-game', 
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

// Initializes and starts the Phaser game when the window loads.
window.addEventListener('load', () => {
    new Phaser.Game(config);
});