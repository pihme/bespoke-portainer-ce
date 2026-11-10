package workflows

import (
	"fmt"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/internal/authorization"
	"github.com/portainer/portainer/api/internal/endpointutils"
	"github.com/portainer/portainer/api/internal/snapshot"
	"github.com/portainer/portainer/api/set"
	"github.com/portainer/portainer/api/slicesx"
	"github.com/portainer/portainer/api/stacks/stackutils"
)

// HasAccessibleSource reports whether any of the artifact's files has a source visible in
// sourceMap.
func HasAccessibleSource(files []portainer.ArtifactFile, sourceMap map[portainer.SourceID]portainer.Source) bool {
	return slicesx.Some(files, func(f portainer.ArtifactFile) bool {
		_, ok := sourceMap[f.SourceID]
		return ok
	})
}

// ArtifactBackingExists reports whether the artifact's target stack or edge stack still exists,
// using the caller-supplied existence checks. An artifact with neither StackID nor EdgeStackID set
// has no backing target.
//
// The check is expressed as caller-supplied closures rather than a shared store interface because
// CE and EE each define their own Stack/EdgeStack service and domain types (portainer.Stack vs
// portaineree.Stack), so a single interface type cannot be satisfied by both editions' DataStoreTx.
func ArtifactBackingExists(a portainer.Artifact, stackExists func(portainer.StackID) (bool, error), edgeStackExists func(portainer.EdgeStackID) (bool, error)) (bool, error) {
	switch {
	case a.StackID != 0:
		return stackExists(a.StackID)
	case a.EdgeStackID != 0:
		return edgeStackExists(a.EdgeStackID)
	default:
		return false, nil
	}
}

// EndpointMatchesStackType reports whether ep is a valid target for stackType.
func EndpointMatchesStackType(ep portainer.Endpoint, stackType portainer.StackType) bool {
	switch stackType {
	case portainer.DockerSwarmStack:
		return len(ep.Snapshots) > 0 && ep.Snapshots[0].Swarm
	case portainer.DockerComposeStack:
		return len(ep.Snapshots) == 0 || !ep.Snapshots[0].Swarm
	case portainer.KubernetesStack:
		return endpointutils.IsKubernetesEndpoint(&ep)
	default:
		return true
	}
}

// BuildEndpointMap reads and returns the endpoints backing stacks, keyed by endpoint ID, with
// snapshot data filled in.
func BuildEndpointMap(tx dataservices.DataStoreTx, stacks []portainer.Stack) (map[portainer.EndpointID]portainer.Endpoint, error) {
	ids := set.ToSet(slicesx.Map(stacks, func(s portainer.Stack) portainer.EndpointID { return s.EndpointID }))

	endpoints, err := tx.Endpoint().ReadAll(func(ep portainer.Endpoint) bool { return ids[ep.ID] })
	if err != nil {
		return nil, err
	}

	m := make(map[portainer.EndpointID]portainer.Endpoint, len(endpoints))
	for i := range endpoints {
		if err := snapshot.FillSnapshotData(tx, &endpoints[i], false); err != nil {
			return nil, fmt.Errorf("unable to fill snapshot data for endpoint %d: %w", endpoints[i].ID, err)
		}
		m[endpoints[i].ID] = endpoints[i]
	}

	return m, nil
}

// FilterDockerStacksByAccess filters stacks to only those the current user can access.
func FilterDockerStacksByAccess(tx dataservices.DataStoreTx, stacks []portainer.Stack, sc *security.RestrictedRequestContext) ([]portainer.Stack, error) {
	if sc.IsAdmin {
		return stacks, nil
	}

	// do not try to check UAC on kube stacks
	filtered, dockerStacks := slicesx.Partition(stacks, func(s portainer.Stack) bool { return s.Type == portainer.KubernetesStack })

	stackResourceIDSet := set.ToSet(slicesx.Map(dockerStacks, func(s portainer.Stack) string {
		return stackutils.ResourceControlID(s.EndpointID, s.Name)
	}))

	resourceControls, err := tx.ResourceControl().ReadAll(func(rc portainer.ResourceControl) bool {
		return rc.Type == portainer.StackResourceControl && stackResourceIDSet[rc.ResourceID]
	})
	if err != nil {
		return nil, err
	}

	dockerStacks = authorization.DecorateStacks(dockerStacks, resourceControls)

	userTeamIDs := authorization.TeamIDs(sc.UserMemberships)
	filtered = append(filtered, authorization.FilterAuthorizedStacks(dockerStacks, sc.UserID, userTeamIDs)...)
	return filtered, nil
}

// filterK8SStacks drops Kubernetes stacks. Their namespace access was only ever resolved for
// Kubernetes environments, which no longer exist, so such a stack was never visible (TAI-023).
// Docker stacks pass through unchanged.
func filterK8SStacks(items []portainer.Stack) []portainer.Stack {
	return slicesx.Filter(items, func(s portainer.Stack) bool {
		return s.Type != portainer.KubernetesStack
	})
}
