import _ from 'lodash';

import { trimSHA } from '@/docker/filters/utils';

import { DockerImage } from './types';
import { DockerImageResponse } from './types/response';

type ImageModel = {
  Image: string;
};

export function parseViewModel(response: DockerImageResponse): DockerImage {
  return {
    ...response,
    Used: false,
    RepoTags:
      response.RepoTags ??
      response.RepoDigests.map((digest) => `${trimSHA(digest)}:<none>`),
  };
}

export function getUniqueTagListFromImages(
  images: Array<{ RepoTags?: string[] }>
) {
  return _.uniq(
    images.flatMap((image) =>
      image.RepoTags
        ? image.RepoTags.filter((item) => !item.includes('<none>'))
        : []
    )
  );
}

export function imageContainsURL(image: string) {
  const split = image.split('/');
  const url = split[0];
  if (split.length > 1) {
    return url.includes('.') || url.includes(':');
  }
  return false;
}

export function buildImageFullURIFromModel(imageModel: ImageModel) {
  return buildImageFullURI(imageModel.Image);
}

/**
 * builds the complete uri for an image name; registries are gone (TAI-005),
 * so the name is used as typed and only gets a default tag
 */
export function buildImageFullURI(image: string) {
  if (!image) {
    throw new Error('Missing image');
  }

  return image.includes(':') ? image : `${image}:latest`;
}

/**
 * Splits a full URI into repository and tag.
 *
 * @param fullURI - The full URI to be split.
 * @returns An object containing the repository and tag.
 */
export function fullURIIntoRepoAndTag(fullURI: string) {
  // possible fullURI values (all should contain a tag):
  // - registry/image-repo:tag
  // - image-repo:tag
  // - registry:port/image-repo:tag
  // - localhost:5000/nginx
  // buildImageFullURIFromModel always gives a tag (defaulting to 'latest'), so the tag is always present after the last ':'
  const parts = fullURI.split(':');
  const tag = parts.pop() || 'latest';

  // handle the case of a repo with a non standard port
  if (tag.includes('/')) {
    return {
      repo: fullURI,
      tag: 'latest',
    };
  }
  const repo = parts.join(':');
  return {
    repo,
    tag,
  };
}
