package stacks

import (
	"errors"
	"net/http"
	"strconv"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/dataservices"
	"github.com/portainer/portainer/api/dataservices/source"
	"github.com/portainer/portainer/api/gitops/workflows"
	httperrors "github.com/portainer/portainer/api/http/errors"
	"github.com/portainer/portainer/api/http/security"
	"github.com/portainer/portainer/api/stacks/stackutils"
	httperror "github.com/portainer/portainer/pkg/libhttp/error"
	"github.com/portainer/portainer/pkg/libhttp/request"
	"github.com/portainer/portainer/pkg/libhttp/response"

	"github.com/rs/zerolog/log"
)

// @id StackDelete
// @summary Remove a stack
// @description Remove a stack.
// @description **Access policy**: restricted
// @tags stacks
// @param id path int true "Stack identifier"
// @param endpointId query int true "Environment identifier"
// @success 204 "Success"
// @failure 400 "Invalid request"
// @failure 403 "Permission denied"
// @failure 404 "Not found"
// @failure 500 "Server error"
// @router /stacks/{id} [delete]
func (handler *Handler) stackDelete(w http.ResponseWriter, r *http.Request) *httperror.HandlerError {
	stackID, err := request.RetrieveRouteVariableValue(r, "id")
	if err != nil {
		return httperror.BadRequest("Invalid stack identifier route variable", err)
	}

	securityContext, err := security.RetrieveRestrictedRequestContext(r)
	if err != nil {
		return httperror.InternalServerError("Unable to retrieve info from request context", err)
	}

	// Deleting external stacks only ever covered Docker Swarm, which is removed (TAI-003).
	if externalStack, _ := request.RetrieveBooleanQueryParameter(r, "external", true); externalStack {
		return httperror.BadRequest("Deleting external stacks is no longer supported", errors.New("Docker Swarm is removed"))
	}

	id, err := strconv.Atoi(stackID)
	if err != nil {
		return httperror.BadRequest("Invalid stack identifier route variable", err)
	}

	stack, err := handler.DataStore.Stack().Read(portainer.StackID(id))
	if handler.DataStore.IsErrObjectNotFound(err) {
		return httperror.NotFound("Unable to find a stack with the specified identifier inside the database", err)
	} else if err != nil {
		return httperror.InternalServerError("Unable to find a stack with the specified identifier inside the database", err)
	}

	endpointID, err := request.RetrieveNumericQueryParameter(r, "endpointId", true)
	if err != nil {
		return httperror.BadRequest("Invalid query parameter: endpointId", err)
	}

	isOrphaned := portainer.EndpointID(endpointID) != stack.EndpointID

	if isOrphaned && !securityContext.IsAdmin {
		return httperror.Forbidden("Permission denied to remove orphaned stack", errors.New("Permission denied to remove orphaned stack"))
	}

	endpoint, err := handler.DataStore.Endpoint().Endpoint(portainer.EndpointID(endpointID))
	if handler.DataStore.IsErrObjectNotFound(err) {
		return httperror.NotFound("Unable to find the endpoint associated to the stack inside the database", err)
	} else if err != nil {
		return httperror.InternalServerError("Unable to find the endpoint associated to the stack inside the database", err)
	}

	resourceControl, err := handler.DataStore.ResourceControl().ResourceControlByResourceIDAndType(stackutils.ResourceControlID(stack.EndpointID, stack.Name), portainer.StackResourceControl)
	if err != nil {
		return httperror.InternalServerError("Unable to retrieve a resource control associated to the stack", err)
	}

	if !isOrphaned {
		if err := handler.requestBouncer.AuthorizedEndpointOperation(r, endpoint); err != nil {
			return httperror.Forbidden("Permission denied to access endpoint", err)
		}

		if stack.Type == portainer.DockerSwarmStack || stack.Type == portainer.DockerComposeStack {
			access, err := handler.userCanAccessStack(securityContext, resourceControl)
			if err != nil {
				return httperror.InternalServerError("Unable to verify user authorizations to validate stack access", err)
			}
			if !access {
				return httperror.Forbidden("Access denied to resource", httperrors.ErrResourceAccessDenied)
			}
		}
	}

	canManage, err := handler.userCanManageStacks(securityContext, endpoint)
	if err != nil {
		return httperror.InternalServerError("Unable to verify user authorizations to validate stack deletion", err)
	}
	if !canManage {
		errMsg := "stack deletion is disabled for non-admin users"
		return httperror.Forbidden(errMsg, errors.New(errMsg))
	}

	if err := handler.teardownService.RemoveResources(r.Context(), securityContext.UserID, stack, endpoint); err != nil {
		return httperror.InternalServerError(err.Error(), err)
	}

	var reconcileSourceID portainer.SourceID
	if err := handler.DataStore.UpdateTx(func(tx dataservices.DataStoreTx) error {
		if stack.WorkflowID != 0 {
			if _, sid, err := loadGitConfigForStack(tx, source.InsecureNewAdminContext(), stack.WorkflowID, stack.ID); err == nil {
				reconcileSourceID = sid
			}

			if err := workflows.DetachStackArtifact(tx, stack.WorkflowID, stack.ID); err != nil {
				return err
			}
		}

		return handler.teardownService.DeleteRecords(tx, stack)
	}); err != nil {
		return httperror.InternalServerError("Unable to remove the stack from the database", err)
	}

	if err := handler.teardownService.RemoveFiles(stack); err != nil {
		log.Warn().Err(err).Int("stack_id", int(stack.ID)).Msg("unable to remove stack files after stack deletion")
	}

	if err := handler.SourceScheduler.Reconcile(reconcileSourceID); err != nil {
		log.Warn().Err(err).Msg("source scheduler reconcile failed after stack deletion")
	}

	return response.Empty(w)
}
