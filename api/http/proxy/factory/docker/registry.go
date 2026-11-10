package docker

import (
	portainer "github.com/portainer/portainer/api"
)

type (
	registryAuthenticationHeader struct {
		Username      string `json:"username"`
		Password      string `json:"password"`
		Serveraddress string `json:"serveraddress"`
	}

	portainerRegistryAuthenticationHeader struct {
		RegistryId *portainer.RegistryID `json:"registryId"`
	}
)

// createRegistryAuthenticationHeader returns anonymous Docker Hub access for
// registry ID 0. There are no stored registries (TAI-023), so any other ID
// matches nothing and gets an empty header, as before.
func createRegistryAuthenticationHeader(registryID portainer.RegistryID) (authenticationHeader registryAuthenticationHeader) {
	if registryID == 0 { // dockerhub (anonymous)
		authenticationHeader.Serveraddress = "docker.io"
	}

	return
}
