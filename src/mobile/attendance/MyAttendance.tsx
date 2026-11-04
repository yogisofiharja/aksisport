import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ListGroup, ListRow } from "../../design-system/ui/List";
import { Sheet } from "../../design-system/feedback/Sheet";
import { EmptyState } from "../../design-system/feedback/EmptyState";
import { useTranslation } from "../../i18n";
import { getMyAttendance } from "../../core/attendance/api";
import { hasAttendance } from "../../core/attendance/attendance";
import { formatDateTime } from "../../core/sessions/sessionSchedule";
import type { Attendance } from "../../core/api/types";
import { OUTCOME_LABEL, attendanceLine } from "./AttendanceSummary";

// DP-029, the player's own record on Me: a row with the counts, opening
// the list of Sessions behind them (every Community).
export function MyAttendanceRow() {
  const { t, lang } = useTranslation();
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [open, setOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getMyAttendance()
        .then(setAttendance)
        .catch(() => {});
    }, []),
  );

  const any = attendance ? hasAttendance(attendance.all) : false;
  return (
    <>
      <ListRow
        icon="calendar-outline"
        title={t("attendanceTitle")}
        subtitle={
          attendance
            ? any
              ? attendanceLine(attendance.all, t)
              : t("attendanceNone")
            : undefined
        }
        chevron
        onPress={() => setOpen(true)}
      />
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t("attendanceTitle")}
        description={t("attendanceExplain")}
      >
        {attendance && attendance.sessions.length > 0 ? (
          <ListGroup>
            {attendance.sessions.map((e) => (
              <ListRow
                key={e.sessionId}
                title={e.sessionName || e.clubName}
                subtitle={[
                  e.clubName,
                  e.startsAt ? formatDateTime(e.startsAt, lang) : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                aside={t(OUTCOME_LABEL[e.outcome])}
                meta={e.corrected ? t("attendanceCorrectedNote") : undefined}
              />
            ))}
          </ListGroup>
        ) : (
          <EmptyState message={t("attendanceNone")} />
        )}
      </Sheet>
    </>
  );
}
