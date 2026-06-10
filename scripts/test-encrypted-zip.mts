/**
 * Probe: encrypted ZIP detection + happy-path E2E for analyzeZip.
 * Run: cd <app-root> && npx tsx --no-deprecation scripts/test-encrypted-zip.mts
 */
import { readFileSync } from "node:fs";
import { analyzeZip } from "../src/lib/playground/instagram/analyzeZip";
import { AnalysisError } from "../src/lib/playground/instagram/types";

// ---------------------------------------------------------------------------
// Build a minimal password-protected ZIP stub.
// A real encrypted ZIP has general-purpose bit flag 0x0001 set.
// JSZip reads the local file header and throws when it sees the encryption bit.
// Local File Header layout (https://pkware.cachefly.net/webpages/casestudies/APPNOTE.TXT):
//   Signature  4B  PK\x03\x04
//   Version    2B
//   GP bits    2B  ← set 0x0001 = encrypted
//   Method     2B
//   ModTime    2B
//   ModDate    2B
//   CRC32      4B
//   Compressed 4B
//   Uncomp     4B
//   FNameLen   2B
//   ExtraLen   2B
//   FName      (variable)
// Central Directory + EOCD are included so JSZip doesn't bail earlier.
function buildEncryptedZipBuffer(): Buffer {
  // Local file header for a zero-byte file named "x"
  const fname = Buffer.from("x");
  const localHeader = Buffer.alloc(30 + fname.length);
  localHeader.writeUInt32LE(0x04034b50, 0); // signature
  localHeader.writeUInt16LE(20, 4);          // version needed
  localHeader.writeUInt16LE(0x0001, 6);      // GP bit: encrypted
  localHeader.writeUInt16LE(0, 8);           // method: stored
  localHeader.writeUInt16LE(0, 10);          // mod time
  localHeader.writeUInt16LE(0, 12);          // mod date
  localHeader.writeUInt32LE(0, 14);          // crc32
  localHeader.writeUInt32LE(0, 18);          // compressed size
  localHeader.writeUInt32LE(0, 22);          // uncompressed size
  localHeader.writeUInt16LE(fname.length, 26); // filename length
  localHeader.writeUInt16LE(0, 28);          // extra field length
  fname.copy(localHeader, 30);

  const localOffset = 0;

  // Central directory entry
  const cdEntry = Buffer.alloc(46 + fname.length);
  cdEntry.writeUInt32LE(0x02014b50, 0);      // signature
  cdEntry.writeUInt16LE(20, 4);              // version made by
  cdEntry.writeUInt16LE(20, 6);              // version needed
  cdEntry.writeUInt16LE(0x0001, 8);          // GP bit: encrypted
  cdEntry.writeUInt16LE(0, 10);              // method
  cdEntry.writeUInt16LE(0, 12);              // mod time
  cdEntry.writeUInt16LE(0, 14);              // mod date
  cdEntry.writeUInt32LE(0, 16);              // crc32
  cdEntry.writeUInt32LE(0, 20);              // compressed size
  cdEntry.writeUInt32LE(0, 24);              // uncompressed size
  cdEntry.writeUInt16LE(fname.length, 28);   // filename length
  cdEntry.writeUInt16LE(0, 30);              // extra length
  cdEntry.writeUInt16LE(0, 32);              // comment length
  cdEntry.writeUInt16LE(0, 34);              // disk number start
  cdEntry.writeUInt16LE(0, 36);              // int file attributes
  cdEntry.writeUInt32LE(0, 38);              // ext file attributes
  cdEntry.writeInt32LE(localOffset, 42);     // local header offset
  fname.copy(cdEntry, 46);

  const cdOffset = localHeader.length;
  const cdSize = cdEntry.length;

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);   // signature
  eocd.writeUInt16LE(0, 4);            // disk number
  eocd.writeUInt16LE(0, 6);            // disk with cd start
  eocd.writeUInt16LE(1, 8);            // num entries this disk
  eocd.writeUInt16LE(1, 10);           // total num entries
  eocd.writeUInt32LE(cdSize, 12);      // size of CD
  eocd.writeUInt32LE(cdOffset, 16);    // offset of CD
  eocd.writeUInt16LE(0, 20);           // comment length

  return Buffer.concat([localHeader, cdEntry, eocd]);
}

function bufferToFile(buf: Buffer, name: string): File {
  // Uint8Array.from copies into a plain ArrayBuffer, satisfying File's BlobPart constraint
  return new File([Uint8Array.from(buf)], name, { type: "application/zip" });
}

// ---------------------------------------------------------------------------
// Test 1: encrypted ZIP → ENCRYPTED_ZIP error
async function testEncryptedZip() {
  console.log("\n=== Test 1: encrypted ZIP probe ===");
  const buf = buildEncryptedZipBuffer();
  const file = bufferToFile(buf, "enc.zip");
  try {
    await analyzeZip(file);
    console.error("FAIL: expected AnalysisError('ENCRYPTED_ZIP') but analyzeZip resolved");
    process.exit(1);
  } catch (err) {
    // Use duck-typing: tsx may load AnalysisError from two different module paths
    // (symlink vs real path), so instanceof can fail even when the class matches.
    if (err instanceof AnalysisError || (err instanceof Error && "code" in err)) {
      const code = (err as { code?: string }).code;
      if (code === "ENCRYPTED_ZIP") {
        console.log(`PASS: threw AnalysisError code=${code}`);
      } else {
        console.error(`FAIL: threw AnalysisError but wrong code: ${code}`);
        process.exit(1);
      }
    } else {
      console.error("FAIL: threw non-AnalysisError:", err);
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Test 2: happy-path E2E — real instagram export
async function testHappyPath() {
  console.log("\n=== Test 2: happy-path E2E ===");
  const zipPath = "/var/www/html/_______site_BANDSUSTAIN/instagram-_mongsil_kim-2026-06-08-qNJMxQEM.zip";
  let buf: Buffer;
  try {
    buf = readFileSync(zipPath);
  } catch {
    console.warn(`SKIP: zip not found at ${zipPath} — copy to /tmp to run E2E`);
    return;
  }
  const file = bufferToFile(buf, "ig.zip");
  const result = await analyzeZip(file);
  const followers = result.relations.followers.length;
  const following = result.relations.following.length;
  console.log(`followers=${followers} following=${following}`);
  // Expected: followers 528, following 774
  if (followers !== 528 || following !== 774) {
    console.error(`FAIL: expected followers=528 following=774 but got followers=${followers} following=${following}`);
    process.exit(1);
  }
  console.log("PASS: followers=528 following=774");
}

// ---------------------------------------------------------------------------
await testEncryptedZip();
await testHappyPath();
console.log("\nAll tests passed.");
