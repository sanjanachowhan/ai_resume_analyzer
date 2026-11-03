// Builds a tiny fake ZIP archive that only DECLARES big sizes (it contains no real data).
// Used to check that zip-bomb protection works, without creating a dangerous file.
export function buildFakeZip(entries) {
  const localHeader = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(26)]); // starts like a real zip

  const directory = Buffer.concat(
    entries.map(({ name = 'word/document.xml', compressed = 100, uncompressed = 100 }) => {
      const nameBytes = Buffer.from(name);
      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt32LE(compressed, 20);
      entry.writeUInt32LE(uncompressed, 24);
      entry.writeUInt16LE(nameBytes.length, 28);
      return Buffer.concat([entry, nameBytes]);
    })
  );

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(localHeader.length, 16);

  return Buffer.concat([localHeader, directory, end]);
}

// A "zip bomb": a few kilobytes that claim to expand to 2 GB.
export const zipBomb = () => buildFakeZip([{ compressed: 2000, uncompressed: 2 * 1024 * 1024 * 1024 }]);
