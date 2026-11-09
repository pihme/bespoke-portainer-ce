package schedule_test

import (
	"testing"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/schedule"
	"github.com/portainer/portainer/api/datastore"
	"github.com/stretchr/testify/require"
)

func TestScheduleCRUDAndByJobType(t *testing.T) {
	t.Parallel()
	_, store := datastore.MustNewTestStore(t, true, false)

	svc, err := schedule.NewService(store.Connection())
	require.NoError(t, err)
	require.Equal(t, schedule.BucketName, svc.BucketName())

	id := portainer.ScheduleID(store.ScheduleService.GetNextIdentifier())
	snap := &portainer.Schedule{
		ID:             id,
		Name:           "local-snapshot",
		CronExpression: "*/5 * * * *",
		JobType:        portainer.JobType(portainer.SnapshotJobType),
		Created:        1,
	}
	require.NoError(t, store.ScheduleService.CreateSchedule(snap))

	got, err := store.ScheduleService.Schedule(id)
	require.NoError(t, err)
	require.Equal(t, "local-snapshot", got.Name)
	require.Equal(t, portainer.JobType(portainer.SnapshotJobType), got.JobType)

	got.CronExpression = "*/10 * * * *"
	require.NoError(t, store.ScheduleService.UpdateSchedule(id, got))

	updated, err := store.ScheduleService.Schedule(id)
	require.NoError(t, err)
	require.Equal(t, "*/10 * * * *", updated.CronExpression)

	all, err := store.ScheduleService.Schedules()
	require.NoError(t, err)
	require.NotEmpty(t, all)

	byType, err := store.ScheduleService.SchedulesByJobType(portainer.JobType(portainer.SnapshotJobType))
	require.NoError(t, err)
	require.Len(t, byType, 1)
	require.Equal(t, id, byType[0].ID)

	other, err := store.ScheduleService.SchedulesByJobType(portainer.JobType(99))
	require.NoError(t, err)
	require.Empty(t, other)

	require.NoError(t, store.ScheduleService.DeleteSchedule(id))
	_, err = store.ScheduleService.Schedule(id)
	require.Error(t, err)
	require.True(t, dataservices.IsErrObjectNotFound(err))
}
