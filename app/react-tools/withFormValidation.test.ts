import { describe, expect, it, vi, beforeEach } from 'vitest';
import { number, object, string, SchemaOf } from 'yup';

vi.mock('@/react-tools/react2angular', () => ({
  r2a: vi.fn((Component: unknown, props: string[]) => ({
    Component,
    props,
  })),
}));

vi.mock('@@/form-components/validate-form', () => ({
  validateForm: vi.fn(),
}));

import { r2a } from '@/react-tools/react2angular';
import { validateForm } from '@@/form-components/validate-form';

import {
  createFormValidationComponent,
  withFormValidation,
} from './withFormValidation';

type FormModel = { name: string; replicas: number };

function schemaBuilder(): SchemaOf<FormModel> {
  return object({
    name: string().required(),
    replicas: number().required(),
  });
}

function mockValidateOnce(result: unknown) {
  vi.mocked(validateForm).mockImplementationOnce(
    async (builder: () => unknown) => {
      builder();
      return result as never;
    }
  );
}

describe('withFormValidation', () => {
  beforeEach(() => {
    vi.mocked(r2a).mockClear();
    vi.mocked(validateForm).mockReset();
  });

  it('registers a react bridge component and an Angular validation wrapper', () => {
    const component = vi.fn();
    const ngModule = {
      component: vi.fn().mockReturnThis(),
    };

    withFormValidation(
      ngModule as never,
      component as never,
      'stackNameField',
      ['disabled'] as never,
      schemaBuilder
    );

    expect(r2a).toHaveBeenCalledWith(component, [
      'errors',
      'onChange',
      'values',
      'disabled',
    ]);
    expect(ngModule.component).toHaveBeenCalledTimes(2);
    expect(ngModule.component.mock.calls[0][0]).toBe('reactStackNameField');
    expect(ngModule.component.mock.calls[1][0]).toBe('stackNameField');
  });

  it('createFormValidationComponent builds template, bindings and controller', async () => {
    const options = createFormValidationComponent(
      'reactStackNameField',
      ['disabled'],
      schemaBuilder
    );

    expect(options.template).toContain('react-stack-name-field');
    expect(options.template).toContain('disabled="$ctrl.disabled"');
    expect(options.template).toContain('on-change="($ctrl.handleChange)"');
    expect(options.bindings).toMatchObject({
      disabled: '<',
      errors: '<',
      values: '<',
      validationData: '<',
      onChange: '<',
    });

    const Controller = options.controller as new (
      $async: <T>(fn: () => Promise<T>) => Promise<T>
    ) => {
      form?: { $setValidity: ReturnType<typeof vi.fn> };
      values?: FormModel;
      validationData?: unknown;
      onChange?: (v: FormModel) => void;
      errors?: unknown;
      handleChange: (v: FormModel) => Promise<void>;
      runValidation: (v: FormModel) => Promise<void>;
      $onChanges: (
        changes: Record<string, { currentValue: unknown }>
      ) => Promise<void>;
    };

    const $async = async <T>(fn: () => Promise<T>) => fn();
    const ctrl = new Controller($async);
    ctrl.form = { $setValidity: vi.fn() };
    ctrl.onChange = vi.fn();

    mockValidateOnce({ name: 'required' });
    await ctrl.handleChange({ name: '', replicas: 1 });
    expect(ctrl.onChange).toHaveBeenCalledWith({ name: '', replicas: 1 });
    expect(ctrl.form.$setValidity).toHaveBeenCalledWith(
      'form',
      true,
      ctrl.form
    );
    expect(ctrl.form.$setValidity).toHaveBeenCalledWith(
      'form',
      false,
      ctrl.form
    );
    expect(ctrl.errors).toEqual({ name: 'required' });

    mockValidateOnce(undefined);
    await ctrl.runValidation({ name: 'ok', replicas: 2 });
    expect(ctrl.errors).toBeUndefined();
    expect(ctrl.form.$setValidity).toHaveBeenLastCalledWith(
      'form',
      true,
      ctrl.form
    );

    mockValidateOnce(undefined);
    await ctrl.$onChanges({
      values: { currentValue: { name: 'from-parent', replicas: 3 } },
    });
    expect(validateForm).toHaveBeenCalled();

    ctrl.values = { name: 'kept', replicas: 1 };
    mockValidateOnce(undefined);
    await ctrl.$onChanges({
      validationData: { currentValue: { max: 5 } },
    });
    expect(validateForm).toHaveBeenCalled();
  });

  it('validates primitives by wrapping them in a value object', async () => {
    const primitiveSchema = () => string().required() as never;
    const options = createFormValidationComponent(
      'reactPrimitiveField',
      [],
      primitiveSchema,
      true
    );
    const Controller = options.controller as new (
      $async: <T>(fn: () => Promise<T>) => Promise<T>
    ) => {
      runValidation: (v: string) => Promise<void>;
      errors?: unknown;
      form?: { $setValidity: ReturnType<typeof vi.fn> };
    };
    const ctrl = new Controller(async (fn) => fn());
    ctrl.form = { $setValidity: vi.fn() };

    mockValidateOnce({
      value: 'Value is required',
    });
    await ctrl.runValidation('');
    expect(validateForm).toHaveBeenCalledWith(expect.any(Function), {
      value: '',
    });
    expect(ctrl.errors).toBe('Value is required');
  });
});
