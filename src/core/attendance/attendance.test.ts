import { describe, expect, it } from "vitest";
import {
  attendanceCorrection,
  canCorrectAttendance,
  hasAttendance,
  shownStatus,
} from "./attendance";
import type { SessionParticipant } from "../api/types";

const player = (status: SessionParticipant["status"]): SessionParticipant => ({
  id: "p",
  sessionId: "s",
  userId: "u",
  status,
  joinedAt: "2026-11-01T00:00:00Z",
  hasReceipt: false,
});

describe("canCorrectAttendance", () => {
  const session = {
    status: "completed" as const,
    startsAt: "2026-11-01T07:00:00Z",
    durationMinutes: 120,
  };
  it("allows 7 days after the end", () => {
    expect(
      canCorrectAttendance(session, new Date("2026-11-08T08:59:00Z")),
    ).toBe(true);
    expect(
      canCorrectAttendance(session, new Date("2026-11-08T09:01:00Z")),
    ).toBe(false);
  });
  it("only for completed Sessions", () => {
    expect(
      canCorrectAttendance(
        { ...session, status: "in_progress" },
        new Date("2026-11-01T08:00:00Z"),
      ),
    ).toBe(false);
  });
});

describe("shownStatus and attendanceCorrection", () => {
  it("a confirmed player who never came is a no-show once completed", () => {
    expect(shownStatus(player("registered"), { status: "completed" })).toBe(
      "no_show",
    );
    expect(shownStatus(player("registered"), { status: "in_progress" })).toBe(
      "registered",
    );
    expect(
      attendanceCorrection(player("registered"), { status: "completed" }),
    ).toBe("markAttended");
    expect(
      attendanceCorrection(player("checked_out"), { status: "completed" }),
    ).toBe("markNoShow");
    expect(
      attendanceCorrection(player("cancelled"), { status: "completed" }),
    ).toBeNull();
    expect(
      attendanceCorrection(player("waitlist"), { status: "completed" }),
    ).toBeNull();
  });
});

describe("hasAttendance", () => {
  it("is false for a new player", () => {
    expect(hasAttendance({ attended: 0, noShows: 0, lateCancels: 0 })).toBe(
      false,
    );
    expect(hasAttendance({ attended: 0, noShows: 1, lateCancels: 0 })).toBe(
      true,
    );
  });
});
