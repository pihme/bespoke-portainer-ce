import {
  useQueryClient,
  useMutation,
  MutationFunction,
} from '@tanstack/react-query';

import { createLocalDockerEnvironment } from '../environment.service/create';

export function useCreateLocalDockerEnvironmentMutation() {
  return useGenericCreationMutation(createLocalDockerEnvironment);
}

function useGenericCreationMutation<TData = unknown, TVariables = void>(
  mutation: MutationFunction<TData, TVariables>
) {
  const queryClient = useQueryClient();

  return useMutation(mutation, {
    onSuccess() {
      return queryClient.invalidateQueries(['environments']);
    },
    meta: {
      error: {
        title: 'Failure',
        message: 'Unable to create environment',
      },
    },
  });
}
