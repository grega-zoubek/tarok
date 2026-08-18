import { describe, it, expect } from "vitest";
import {
  createAnnouncementsRound,
  placeAnnouncement,
  passAnnouncements,
  getCurrentAnnouncingPlayer
} from "../../src/announcements/announcements.js";

describe("Announcements", () => {
  const playerOrder = [0, 1, 2, 3];

  it("initializes an announcements round correctly", () => {
    // Declarer is 0, starts with forehand 0
    const round = createAnnouncementsRound(playerOrder, 0, 0);
    
    expect(round.declarer).toBe(0);
    expect(round.consecutivePasses).toBe(0);
    expect(round.isFinished).toBe(false);
    expect(getCurrentAnnouncingPlayer(round)).toBe(0);
  });

  it("allows a player to make an announcement and then pass", () => {
    let round = createAnnouncementsRound(playerOrder, 0, 0);

    round = placeAnnouncement(round, 0, "trula");
    expect(round.announcements[0]?.length).toBe(1);
    expect(round.announcements[0]?.[0]?.type).toBe("trula");
    
    // Conseq passes reset to 0
    expect(round.consecutivePasses).toBe(0);

    // Player then passes
    round = passAnnouncements(round, 0);
    expect(round.consecutivePasses).toBe(1);
    expect(getCurrentAnnouncingPlayer(round)).toBe(1);
  });

  it("throws if a player tries to announce the same thing twice", () => {
    let round = createAnnouncementsRound(playerOrder, 0, 0);

    round = placeAnnouncement(round, 0, "valat");
    expect(() => placeAnnouncement(round, 0, "valat")).toThrowError();
  });

  it("finishes the round after 4 consecutive passes", () => {
    let round = createAnnouncementsRound(playerOrder, 0, 0);

    // Player 0 announces Trula, then passes
    round = placeAnnouncement(round, 0, "trula");
    round = passAnnouncements(round, 0);

    // Player 1 passes
    round = passAnnouncements(round, 1);

    // Player 2 passes
    round = passAnnouncements(round, 2);

    // Player 3 announces Pagat Ultimo! Conseq passes resets to 0.
    round = placeAnnouncement(round, 3, "pagat_ultimo");
    expect(round.consecutivePasses).toBe(0);

    // Player 3 passes
    round = passAnnouncements(round, 3);
    
    // Now it's back to Player 0! Because everyone has a chance to react (e.g. Kontra).
    expect(getCurrentAnnouncingPlayer(round)).toBe(0);

    // Now everyone passes consecutively
    round = passAnnouncements(round, 0); // consecutive passes = 2
    round = passAnnouncements(round, 1); // consecutive passes = 3
    // Player 2's pass will finish the round because Player 3 already passed previously (total 4 passes)
    round = passAnnouncements(round, 2); // consecutive passes = 4

    expect(round.isFinished).toBe(true);
    expect(round.consecutivePasses).toBe(4);
    
    // Testing that trying to pass again (or another player passing) throws
    expect(() => passAnnouncements(round, 3)).toThrowError("Announcements round is already finished");
  });
});
