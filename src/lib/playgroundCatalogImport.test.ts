import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSearchName,
  normalizeName,
  normalizeRow,
  slugify,
} from "./playgroundCatalogImport";

test("normalizeName collapses whitespace and trims", () => {
  assert.equal(normalizeName("  1981   Inventions  "), "1981 Inventions");
  assert.equal(normalizeName("DRV\t (Hyperfade)\n"), "DRV (Hyperfade)");
});

test("slugify produces kebab-case ASCII and is deterministic", () => {
  assert.equal(slugify("1981 Inventions"), "1981-inventions");
  assert.equal(slugify("DRV (Hyperfade)"), "drv-hyperfade");
  assert.equal(slugify("EarthQuaker Devices"), "earthquaker-devices");
  // 호출 두 번 결과 동일
  assert.equal(slugify("Strymon Mobius"), slugify("Strymon Mobius"));
});

test("buildSearchName strips punctuation and lowercases", () => {
  assert.equal(buildSearchName("DRV (Hyperfade)"), "drv hyperfade");
  assert.equal(buildSearchName("Boss DD-200"), "boss dd 200");
});

test("normalizeRow accepts a well-formed pedalplayground entry", () => {
  const item = normalizeRow({
    Brand: "1981 Inventions",
    Name: "DRV",
    Width: 3.7,
    Height: 4.58,
    Image: "1981-inventions-drv.png",
  });
  assert.notEqual(item, null);
  assert.equal(item!.brand, "1981 Inventions");
  assert.equal(item!.name, "DRV");
  assert.equal(item!.brandSlug, "1981-inventions");
  assert.equal(item!.slug, "drv");
  assert.equal(item!.widthIn, 3.7);
  assert.equal(item!.heightIn, 4.58);
  assert.equal(item!.imageFilename, "1981-inventions-drv.png");
});

test("normalizeRow rejects bad inputs", () => {
  // empty brand
  assert.equal(normalizeRow({ Brand: "  ", Name: "DRV", Width: 1, Height: 1 }), null);
  // empty name
  assert.equal(normalizeRow({ Brand: "Boss", Name: "", Width: 1, Height: 1 }), null);
  // non-finite width
  assert.equal(normalizeRow({ Brand: "Boss", Name: "x", Width: Number.NaN, Height: 1 }), null);
  // zero height
  assert.equal(normalizeRow({ Brand: "Boss", Name: "x", Width: 1, Height: 0 }), null);
  // missing Image is allowed (becomes null)
  const ok = normalizeRow({ Brand: "Boss", Name: "x", Width: 1, Height: 1 });
  assert.notEqual(ok, null);
  assert.equal(ok!.imageFilename, null);
});

test("normalizeRow keeps identity stable when only mutable fields change", () => {
  // 같은 (Brand, Name) — width/height/image 가 catalog 교정으로 바뀐 가상의 두 row.
  // brand/name 만으로 보는 식별자는 동일해야 한다 (== upsert 의 lookup 키).
  const a = normalizeRow({
    Brand: "1981 Inventions",
    Name: "DRV",
    Width: 3.7,
    Height: 4.58,
    Image: "1981-inventions-drv.png",
  })!;
  const b = normalizeRow({
    Brand: "1981 Inventions",
    Name: "DRV",
    Width: 3.75, // ← width 교정
    Height: 4.60, // ← height 교정
    Image: "1981-inventions-drv-v2.png", // ← 이미지 교체
  })!;

  // 식별자(brand, name) 와 그 파생(brandSlug, slug, searchName) 은 동일
  assert.equal(a.brand, b.brand);
  assert.equal(a.name, b.name);
  assert.equal(a.brandSlug, b.brandSlug);
  assert.equal(a.slug, b.slug);
  assert.equal(a.searchName, b.searchName);

  // mutable 필드는 다름 — upsert 가 UPDATE 로 흡수해야 하는 부분
  assert.notEqual(a.widthIn, b.widthIn);
  assert.notEqual(a.heightIn, b.heightIn);
  assert.notEqual(a.imageFilename, b.imageFilename);
});
