// --- Game Configuration Constants ---
// Map dimensions: 20 tiles wide x 15 tiles tall
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 64;
export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 15;
export const GAME_WIDTH = MAP_WIDTH * TILE_WIDTH;
export const GAME_HEIGHT = MAP_HEIGHT * TILE_HEIGHT;
export const MUSHROOM_ASSET_KEY = 'mapTile_104'; 

// --- Asset Configuration ---
// Each assetKey MUST match the filename in your local 'TILES/' folder (e.g., TILES/mapTile_171.png)
export const TILES = {
    // 0: WATER
    WATER:        { id: 0, name: 'Water', assetKey: 'mapTile_171' }, 
    
    // 1: DIRT_CENTER
    DIRT_CENTER:  { id: 1, name: 'Dirt Center', assetKey: 'mapTile_082' }, 
    
    // 2-5: Edges (Dirt bordering Water on one side)
    DIRT_EDGE_N:  { id: 2, name: 'Dirt Edge N', assetKey: 'mapTile_072' }, // Water to the North
    DIRT_EDGE_E:  { id: 3, name: 'Dirt Edge E', assetKey: 'mapTile_083' }, // Water to the East
    DIRT_EDGE_S:  { id: 4, name: 'Dirt Edge S', assetKey: 'mapTile_112' }, // Water to the South
    DIRT_EDGE_W:  { id: 5, name: 'Dirt Edge W', assetKey: 'mapTile_081' }, // Water to the West
    
    // 6-9: Corners (Water forms an inner corner)
    DIRT_CORNER_NW: { id: 6, name: 'Dirt Corner NW', assetKey: 'mapTile_071' }, // Water NW
    DIRT_CORNER_NE: { id: 7, name: 'Dirt Corner NE', assetKey: 'mapTile_073' }, // Water NE
    DIRT_CORNER_SE: { id: 8, name: 'Dirt Corner SE', assetKey: 'mapTile_113' }, // Water SE
    DIRT_CORNER_SW: { id: 9, name: 'Dirt Corner SW', assetKey: 'mapTile_111' }, // Water SW
};

export const TILE_IDS = Object.values(TILES).map(t => t.id);
export const INITIAL_POSSIBILITIES = TILE_IDS;

// --- Adjacency Rules (WFC logic for 10 tiles) ---

export const TILE_RULES = {
    // 0: WATER (Can connect to Water or a tile that borders water)
    [TILES.WATER.id]: {
        N: [TILES.DIRT_EDGE_S.id, TILES.DIRT_CORNER_SE.id, TILES.DIRT_CORNER_SW.id, TILES.WATER.id],
        E: [TILES.DIRT_EDGE_W.id, TILES.DIRT_CORNER_NW.id, TILES.DIRT_CORNER_SW.id, TILES.WATER.id],
        S: [TILES.DIRT_EDGE_N.id, TILES.DIRT_CORNER_NW.id, TILES.DIRT_CORNER_NE.id, TILES.WATER.id],
        W: [TILES.DIRT_EDGE_E.id, TILES.DIRT_CORNER_NE.id, TILES.DIRT_CORNER_SE.id, TILES.WATER.id]
    },

    // 1: DIRT_CENTER (Can only connect to other Dirt tiles)
    [TILES.DIRT_CENTER.id]: { N: [TILES.DIRT_EDGE_N.id, TILES.DIRT_CENTER.id], E: [TILES.DIRT_EDGE_E.id, TILES.DIRT_CENTER.id], S: [TILES.DIRT_EDGE_S.id, TILES.DIRT_CENTER.id], W: [TILES.DIRT_EDGE_W.id, TILES.DIRT_CENTER.id] },

    // 2: DIRT_EDGE_N (Water North - must have Water/Water-bordering to the North)
    [TILES.DIRT_EDGE_N.id]: { N: [TILES.WATER.id], E: [TILES.DIRT_EDGE_N.id, TILES.DIRT_CORNER_NE.id], S: [TILES.DIRT_EDGE_S.id, TILES.DIRT_CENTER.id], W: [TILES.DIRT_EDGE_N.id, TILES.DIRT_CORNER_NW.id] },

    // 3: DIRT_EDGE_E (Water East)
    [TILES.DIRT_EDGE_E.id]: { N: [TILES.DIRT_EDGE_E.id, TILES.DIRT_CORNER_NE.id], E: [TILES.WATER.id], S: [TILES.DIRT_EDGE_E.id, TILES.DIRT_CORNER_SE.id], W: [TILES.DIRT_EDGE_W.id, TILES.DIRT_CENTER.id] },

    // 4: DIRT_EDGE_S (Water South)
    [TILES.DIRT_EDGE_S.id]: { N: [TILES.DIRT_EDGE_N.id, TILES.DIRT_CENTER.id], E: [TILES.DIRT_EDGE_S.id, TILES.DIRT_CORNER_SE.id], S: [TILES.WATER.id], W: [TILES.DIRT_EDGE_S.id, TILES.DIRT_CORNER_SW.id] },

    // 5: DIRT_EDGE_W (Water West)
    [TILES.DIRT_EDGE_W.id]: { N: [TILES.DIRT_EDGE_W.id, TILES.DIRT_CORNER_NW.id], E: [TILES.DIRT_EDGE_E.id, TILES.DIRT_CENTER.id], S: [TILES.DIRT_EDGE_W.id, TILES.DIRT_CORNER_SW.id], W: [TILES.WATER.id] },

    // 6: DIRT_CORNER_NW (Water North and West)
    [TILES.DIRT_CORNER_NW.id]: { N: [TILES.WATER.id], E: [TILES.DIRT_EDGE_N.id, TILES.DIRT_CORNER_NE.id], S: [TILES.DIRT_EDGE_W.id, TILES.DIRT_CORNER_SW.id], W: [TILES.WATER.id] },

    // 7: DIRT_CORNER_NE (Water North and East)
    [TILES.DIRT_CORNER_NE.id]: { N: [TILES.WATER.id], E: [TILES.WATER.id], S: [TILES.DIRT_EDGE_E.id, TILES.DIRT_CORNER_SE.id], W: [TILES.DIRT_EDGE_N.id, TILES.DIRT_CORNER_NW.id] },

    // 8: DIRT_CORNER_SE (Water South and East)
    [TILES.DIRT_CORNER_SE.id]: { N: [TILES.DIRT_EDGE_E.id, TILES.DIRT_CORNER_NE.id], E: [TILES.WATER.id], S: [TILES.WATER.id], W: [TILES.DIRT_EDGE_S.id, TILES.DIRT_CORNER_SW.id] },

    // 9: DIRT_CORNER_SW (Water South and West)
    [TILES.DIRT_CORNER_SW.id]: { N: [TILES.DIRT_EDGE_W.id, TILES.DIRT_CORNER_NW.id], E: [TILES.DIRT_EDGE_S.id, TILES.DIRT_CORNER_SE.id], S: [TILES.WATER.id], W: [TILES.WATER.id] },
};