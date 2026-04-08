/** Pre-load all pixel-art assets as HTMLImageElement objects */

export interface LoadedAssets {
  floors: HTMLImageElement[];       // floor_0..floor_8
  walls: HTMLImageElement;          // wall_0 bitmask sheet
  characters: HTMLImageElement[];   // char_0..char_5
  furniture: Map<string, HTMLImageElement>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

export async function loadAllAssets(): Promise<LoadedAssets> {
  const [floors, walls, characters] = await Promise.all([
    // Floors 0-8
    Promise.all(
      Array.from({ length: 9 }, (_, i) => loadImage(`/assets/floors/floor_${i}.png`))
    ),
    // Wall bitmask sheet
    loadImage('/assets/walls/wall_0.png'),
    // Characters 0-5
    Promise.all(
      Array.from({ length: 6 }, (_, i) => loadImage(`/assets/characters/char_${i}.png`))
    ),
  ]);

  // Furniture — load common pieces
  const furnitureNames: [string, string][] = [
    ['DESK_FRONT', '/assets/furniture/DESK/DESK_FRONT.png'],
    ['DESK_SIDE', '/assets/furniture/DESK/DESK_SIDE.png'],
    ['PC_FRONT_OFF', '/assets/furniture/PC/PC_FRONT_OFF.png'],
    ['PC_FRONT_ON_1', '/assets/furniture/PC/PC_FRONT_ON_1.png'],
    ['PC_FRONT_ON_2', '/assets/furniture/PC/PC_FRONT_ON_2.png'],
    ['PC_FRONT_ON_3', '/assets/furniture/PC/PC_FRONT_ON_3.png'],
    ['PC_BACK', '/assets/furniture/PC/PC_BACK.png'],
    ['PC_SIDE', '/assets/furniture/PC/PC_SIDE.png'],
    ['PLANT', '/assets/furniture/PLANT/PLANT.png'],
    ['LARGE_PLANT', '/assets/furniture/LARGE_PLANT/LARGE_PLANT.png'],
    ['SOFA_FRONT', '/assets/furniture/SOFA/SOFA_FRONT.png'],
    ['SOFA_BACK', '/assets/furniture/SOFA/SOFA_BACK.png'],
    ['SOFA_SIDE', '/assets/furniture/SOFA/SOFA_SIDE.png'],
    ['COFFEE', '/assets/furniture/COFFEE/COFFEE.png'],
    ['WHITEBOARD', '/assets/furniture/WHITEBOARD/WHITEBOARD.png'],
    ['CUSHIONED_CHAIR_FRONT', '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png'],
    ['CUSHIONED_CHAIR_BACK', '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_BACK.png'],
    ['CUSHIONED_CHAIR_SIDE', '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_SIDE.png'],
    ['BOOKSHELF', '/assets/furniture/BOOKSHELF/BOOKSHELF.png'],
    ['COFFEE_TABLE', '/assets/furniture/COFFEE_TABLE/COFFEE_TABLE.png'],
    ['BIN', '/assets/furniture/BIN/BIN.png'],
  ];

  const furnitureEntries = await Promise.all(
    furnitureNames.map(async ([name, src]) => {
      try {
        const img = await loadImage(src);
        return [name, img] as [string, HTMLImageElement];
      } catch {
        return null;
      }
    })
  );

  const furniture = new Map<string, HTMLImageElement>();
  for (const entry of furnitureEntries) {
    if (entry) furniture.set(entry[0], entry[1]);
  }

  return { floors, walls, characters, furniture };
}
