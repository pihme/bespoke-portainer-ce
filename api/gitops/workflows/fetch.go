package workflows

import (
	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/set"
)

// SourceStats holds aggregated statistics for a GitOps source.
type SourceStats struct {
	WorkflowCount int
	EndpointIDs   set.Set[portainer.EndpointID]
}

// FetchSourceStats returns per-source stats for sources accessible to the given user.
// It applies the endpoint, Docker access control and stack type filtering of the sources list.
func FetchSourceStats(
	tx dataservices.DataStoreTx,
	sc *security.RestrictedRequestContext,
) (map[portainer.SourceID]SourceStats, error) {

	allStacks, err := tx.Stack().ReadAll(func(s portainer.Stack) bool { return s.WorkflowID != 0 })
	if err != nil {
		return nil, err
	}

	endpointMap, err := BuildEndpointMap(tx, allStacks)
	if err != nil {
		return nil, err
	}

	allStacks, err = FilterDockerStacksByAccess(tx, allStacks, sc)
	if err != nil {
		return nil, err
	}

	workflowIDSet := make(set.Set[portainer.WorkflowID], len(allStacks))
	preFiltered := make([]portainer.Stack, 0, len(allStacks))
	for _, stack := range allStacks {
		if ep, ok := endpointMap[stack.EndpointID]; ok && !EndpointMatchesStackType(ep, stack.Type) {
			continue
		}
		preFiltered = append(preFiltered, stack)
		workflowIDSet.Add(stack.WorkflowID)
	}

	wfMap, err := LoadWorkflowMap(tx, workflowIDSet)
	if err != nil {
		return nil, err
	}

	wfSources := make(map[portainer.WorkflowID][]portainer.SourceID, len(wfMap))
	for id, wf := range wfMap {
		for _, as := range wf.Artifacts {
			for _, f := range as.Files {
				wfSources[id] = append(wfSources[id], f.SourceID)
			}
		}
	}

	stackSourceIDs := make(map[portainer.StackID][]portainer.SourceID)
	for _, stack := range preFiltered {
		if srcIDs := wfSources[stack.WorkflowID]; len(srcIDs) > 0 {
			stackSourceIDs[stack.ID] = srcIDs
		}
	}

	stacks := filterK8SStacks(preFiltered)

	stats := make(map[portainer.SourceID]SourceStats)

	for _, stack := range stacks {
		var epIDs []portainer.EndpointID
		if stack.EndpointID != 0 {
			epIDs = []portainer.EndpointID{stack.EndpointID}
		}
		addSourceStats(stats, stackSourceIDs[stack.ID], epIDs)
	}

	return stats, nil
}

func addSourceStats(result map[portainer.SourceID]SourceStats, srcIDs []portainer.SourceID, epIDs []portainer.EndpointID) {
	for _, srcID := range srcIDs {
		st := result[srcID]
		if st.EndpointIDs == nil {
			st.EndpointIDs = make(set.Set[portainer.EndpointID])
		}
		st.WorkflowCount++
		for _, epID := range epIDs {
			st.EndpointIDs.Add(epID)
		}
		result[srcID] = st
	}
}
