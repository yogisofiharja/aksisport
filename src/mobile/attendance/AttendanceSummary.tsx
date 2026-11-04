import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ListGroup, ListRow } from '../../design-system/ui/List';
import { useTranslation } from '../../i18n';
import { getPersonAttendance } from '../../core/attendance/api';
import { hasAttendance } from '../../core/attendance/attendance';
import type { Attendance, AttendanceCounts, AttendanceOutcome } from '../../core/api/types';

type T = ReturnType<typeof useTranslation>['t'];

export function attendanceLine(c: AttendanceCounts, t: T): string {
  return t('attendanceCounts', c.attended, c.noShows, c.lateCancels);
}

export const OUTCOME_LABEL: Record<AttendanceOutcome, string> = {
  attended: 'attendanceAttended',
  no_show: 'attendanceNoShow',
  late_cancel: 'attendanceLateCancel',
};

// DP-029, for organizers: one row with a player's attendance across every
// Community, shown where they decide about that player (the Session's
// player sheet, a join request). Nothing renders until it has loaded, or
// if it fails.
export function AttendanceSummary({ clubId, userId }: { clubId: string; userId: string }) {
  const { t } = useTranslation();
  const [attendance, setAttendance] = useState<Attendance | null>(null);

  useEffect(() => {
    let live = true;
    setAttendance(null);
    getPersonAttendance(clubId, userId)
      .then((a) => live && setAttendance(a))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [clubId, userId]);

  if (!attendance) return null;
  const any = hasAttendance(attendance.all);
  return (
    <View className="mb-4">
      <ListGroup>
        <ListRow
          icon="calendar-outline"
          iconTone={attendance.all.noShows + attendance.all.lateCancels > 0 ? 'heat' : 'neutral'}
          title={any ? attendanceLine(attendance.all, t) : t('attendanceNone')}
          subtitle={t('attendanceAcrossCommunities')}
        />
      </ListGroup>
    </View>
  );
}
