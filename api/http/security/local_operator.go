package security

import (
	"slices"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
)

// LocalOperatorUsername is the name of the single local operator record that
// holds the UI preferences (theme) and owns what Portainer creates. It is not
// an account: nobody signs in as it (TAI-001).
const LocalOperatorUsername = "admin"

// LocalOperator returns the user record every request is served as: the
// administrator with the lowest identifier. When the store has none yet, it
// returns an unsaved administrator with ID 1.
func LocalOperator(tx dataservices.DataStoreTx) (*portainer.User, error) {
	admins, err := tx.User().UsersByRole(portainer.AdministratorRole)
	if err != nil {
		return nil, err
	}

	if len(admins) == 0 {
		return &portainer.User{ID: 1, Username: LocalOperatorUsername, Role: portainer.AdministratorRole}, nil
	}

	user := slices.MinFunc(admins, func(a, b portainer.User) int { return int(a.ID) - int(b.ID) })
	user.Password = ""

	return &user, nil
}

// EnsureLocalOperator stores the local operator record when the store has no
// administrator yet. It reports whether a record was created.
func EnsureLocalOperator(tx dataservices.DataStoreTx) (bool, error) {
	admins, err := tx.User().UsersByRole(portainer.AdministratorRole)
	if err != nil {
		return false, err
	}

	if len(admins) > 0 {
		return false, nil
	}

	user := &portainer.User{
		Username: LocalOperatorUsername,
		Role:     portainer.AdministratorRole,
	}

	return true, tx.User().Create(user)
}
