import { describe, it, expect } from "vitest";
import {
  createAnnouncementsRound,
  placeAnnouncement,
  placeContra,
  canPlaceContra,
  passAnnouncements,
} from "../../src/announcements/announcements.js";

describe("Kontra", () => {
  const playerOrder = [0, 1, 2, 3];
  const declarerTeam = [0]; // solo

  it("allows defenders to kontra the game", () => {
    let round = createAnnouncementsRound(playerOrder, 0, 0);
    round = passAnnouncements(round, 0); // declarer passes → player 1
    expect(canPlaceContra(round, 1, "game", declarerTeam)).toBe(true);
    round = placeContra(round, 1, "game", declarerTeam);
    expect(round.gameMultiplier).toBe(2);
    expect(round.gameLastContraBy).toBe(1);
  });

  it("allows declarer to rekontra after kontra", () => {
    let round = createAnnouncementsRound(playerOrder, 0, 1);
    // Start with defender 1
    round = placeContra(round, 1, "game", declarerTeam);
    round = passAnnouncements(round, 1);
    round = passAnnouncements(round, 2);
    round = passAnnouncements(round, 3);
    // back to declarer 0
    expect(canPlaceContra(round, 0, "game", declarerTeam)).toBe(true);
    round = placeContra(round, 0, "game", declarerTeam);
    expect(round.gameMultiplier).toBe(4);
  });

  it("allows kontra on an announcement from the opposing team", () => {
    let round = createAnnouncementsRound(playerOrder, 0, 0);
    round = placeAnnouncement(round, 0, "trula");
    round = passAnnouncements(round, 0);
    expect(canPlaceContra(round, 1, "trula", declarerTeam)).toBe(true);
    round = placeContra(round, 1, "trula", declarerTeam);
    const trula = round.announcements[0]?.find((a) => a.type === "trula");
    expect(trula?.multiplierLevel).toBe(2);
    expect(trula?.isContra).toBe(true);
  });

  it("rejects kontra from the same side twice in a row", () => {
    let round = createAnnouncementsRound(playerOrder, 0, 1);
    round = placeContra(round, 1, "game", declarerTeam);
    expect(canPlaceContra(round, 1, "game", declarerTeam)).toBe(false);
    expect(canPlaceContra(round, 2, "game", declarerTeam)).toBe(false);
    expect(() => placeContra(round, 2, "game", declarerTeam)).toThrow();
  });

  it("caps at mordkontra (×16)", () => {
    let round = createAnnouncementsRound(playerOrder, 0, 1);
    // 1→2, 0→4, 1→8, 0→16
    round = placeContra(round, 1, "game", declarerTeam);
    round = { ...round, currentPlayerIndex: 0 };
    round = placeContra(round, 0, "game", declarerTeam);
    round = { ...round, currentPlayerIndex: 1 };
    round = placeContra(round, 1, "game", declarerTeam);
    round = { ...round, currentPlayerIndex: 0 };
    round = placeContra(round, 0, "game", declarerTeam);
    expect(round.gameMultiplier).toBe(16);
    round = { ...round, currentPlayerIndex: 1 };
    expect(canPlaceContra(round, 1, "game", declarerTeam)).toBe(false);
  });
});
