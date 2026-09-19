export type Desk = {
  id: string;
  label: string;
  position: [number, number];
  rotation: number;
};

export type OfficeRoom = {
  id: string;
  name: string;
  capacity: number;
  position: [number, number];
  size: [number, number];
};

const makeDesk = (
  zone: 'N' | 'S',
  bank: number,
  pair: number,
  position: [number, number],
  rotation: number
): Desk => ({
  id: `${zone.toLowerCase()}-${bank + 1}-${pair + 1}-${rotation === 0 ? 'a' : 'b'}`,
  label: `${zone}${bank + 1}.${pair + 1}${rotation === 0 ? 'A' : 'B'}`,
  position,
  rotation,
});

const northBanks = [-2.7, 2.7];
const northRows = [-7.8, -6.2, -4.6, -3, -1.4, 0.2];
const southBanks = [-7, -3.8, -0.6];
const southRows = [6, 8, 10];

export const desks: Desk[] = [
  ...northBanks.flatMap((bank, bankIndex) =>
    northRows.flatMap((z, pairIndex) => [
      makeDesk('N', bankIndex, pairIndex, [bank - 0.7, z], 0),
      makeDesk('N', bankIndex, pairIndex, [bank + 0.7, z], Math.PI),
    ])
  ),
  ...southBanks.flatMap((bank, bankIndex) =>
    southRows.flatMap((z, pairIndex) => [
      makeDesk('S', bankIndex, pairIndex, [bank - 0.7, z], 0),
      makeDesk('S', bankIndex, pairIndex, [bank + 0.7, z], Math.PI),
    ])
  ),
];

export const rooms: OfficeRoom[] = [
  { id: 'west-room', name: 'The library', capacity: 6, position: [-11, 8], size: [3.4, 8] },
  { id: 'front-room-1', name: 'Studio 01', capacity: 4, position: [3, 11], size: [3.7, 4] },
  { id: 'front-room-2', name: 'Studio 02', capacity: 4, position: [7, 11], size: [3.7, 4] },
  { id: 'front-room-3', name: 'The boardroom', capacity: 4, position: [11, 11], size: [3.7, 4] },
  { id: 'east-room', name: 'The nook', capacity: 2, position: [10, 7], size: [3.2, 2.2] },
];
