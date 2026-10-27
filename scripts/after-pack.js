'use strict';

// Windows Defender can keep a handle on the freshly written Capri.exe for a few seconds.
// electron-builder edits the exe's resources right after packing, which then fails with
// EBUSY on this PC: give the scanner a moment before it tries.
module.exports = async function afterPack() {
  await new Promise((resolve) => setTimeout(resolve, 8000));
};
