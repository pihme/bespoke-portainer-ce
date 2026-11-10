package migrator

// migrateEdgeStacksStatuses_2_31_0 clears the legacy per-environment status
// map on Edge stacks. Copying it into the edge_stack_status collection was
// dropped with that collection (TAI-021, TAI-022).
func (m *Migrator) migrateEdgeStacksStatuses_2_31_0() error {
	edgeStacks, err := m.edgeStackService.EdgeStacks()
	if err != nil {
		return err
	}

	for _, edgeStack := range edgeStacks {
		edgeStack.Status = nil

		if err := m.edgeStackService.UpdateEdgeStack(edgeStack.ID, &edgeStack); err != nil {
			return err
		}
	}

	return nil
}
