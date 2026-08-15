import assert from "node:assert/strict";
import test from "node:test";
import { climateFromLatitude, countryFlag, countryFlagUrl, settlementLabel } from "./scene";

test("country flag renders ISO alpha-2 codes", () => {
  assert.equal(countryFlag("kr"), "🇰🇷");
  assert.equal(countryFlag(""), "🌍");
  assert.equal(countryFlagUrl("CD"), "https://flagcdn.com/w80/cd.png");
});

test("climate labels are stable across latitude bands", () => {
  assert.equal(climateFromLatitude(0).label, "열대권");
  assert.equal(climateFromLatitude(40).label, "온대권");
  assert.equal(climateFromLatitude(-70).label, "한대권");
});

test("settlement labels distinguish non-city environments", () => {
  assert.equal(settlementLabel("suburban"), "교외·준도시 지역");
  assert.equal(settlementLabel("dense_town"), "밀집 소도시");
  assert.equal(settlementLabel("very_dispersed_rural"), "외딴 농촌");
});
