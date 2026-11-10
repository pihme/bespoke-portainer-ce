package registryutils

import (
	"context"
	"fmt"
	"time"

	portainer "github.com/portainer/portainer/api"
	"github.com/portainer/portainer/api/aws/ecr"
)

func isRegTokenValid(registry *portainer.Registry) (valid bool) {
	return registry.AccessToken != "" && registry.AccessTokenExpiry > time.Now().Unix()
}

func fetchRegToken(registry *portainer.Registry) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	ecrClient := ecr.NewService(registry.Username, registry.Password, registry.Ecr.Region)
	accessToken, expiryAt, err := ecrClient.GetAuthorizationToken(ctx)
	if err != nil {
		return err
	}
	registry.AccessToken = *accessToken
	registry.AccessTokenExpiry = expiryAt.Unix()

	return nil
}

func GetRegEffectiveCredential(registry *portainer.Registry) (username, password string, err error) {
	username = registry.Username
	password = registry.Password

	if registry.Type == portainer.EcrRegistry {
		// Fallback token refresh in case the upstream caller did not pre-validate the token.
		if !isRegTokenValid(registry) {
			if err := fetchRegToken(registry); err != nil {
				return "", "", fmt.Errorf("ECR registry %q credentials are invalid or expired. Error: %w", registry.Name, err)
			}
		}

		username, password, err = ecr.NewService(registry.Username, registry.Password, registry.Ecr.Region).
			ParseAuthorizationToken(registry.AccessToken)
	}

	return
}
